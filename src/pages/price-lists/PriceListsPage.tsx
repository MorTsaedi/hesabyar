import { useState, useEffect, useCallback, type ReactNode } from 'react';
import type { PriceList, PriceListItem, Product } from '../../types/database';
import { tauriInvoke } from '../../lib/tauri';
import { formatMoney, formatNumber, parsePersianNumber } from '../../lib/persian-number';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { SearchInput } from '../../components/ui/SearchInput';
import { Tags, Plus, Trash2, RefreshCw, Save, Star, Package } from 'lucide-react';

export function PriceListsPage() {
  const [lists, setLists] = useState<PriceList[]>([]);
  const [items, setItems] = useState<PriceListItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedList, setSelectedList] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [listModal, setListModal] = useState(false);
  const [listForm, setListForm] = useState({ name: '', type: 'sale' as 'sale' | 'purchase', isDefault: false });
  const [pendingItems, setPendingItems] = useState<Record<number, string>>({});

  const loadAll = useCallback(async () => {
    try {
      const data = await tauriInvoke<PriceList[]>('get_price_lists', { companyId: 1 });
      setLists(data);
      if (data.length > 0 && (selectedList === null || !data.some((l) => l.id === selectedList))) {
        setSelectedList(data[0].id);
      }
    } catch (e) { setError(String(e)); }
  }, [selectedList]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    tauriInvoke<Product[]>('get_products', { companyId: 1 }).then(setProducts).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedList) return;
    tauriInvoke<PriceListItem[]>('get_price_list_items', { priceListId: selectedList })
      .then(setItems)
      .catch((e) => setError(String(e)));
  }, [selectedList]);

  const createList = async () => {
    try {
      await tauriInvoke('create_price_list', {
        companyId: 1, name: listForm.name, type: listForm.type, isDefault: listForm.isDefault,
      });
      setListModal(false);
      setListForm({ name: '', type: 'sale', isDefault: false });
      setSelectedList(null);
      loadAll();
    } catch (e) { setError(String(e)); }
  };

  const deleteList = async (list: PriceList) => {
    if (!window.confirm(`لیست قیمت «${list.name}» حذف شود؟`)) return;
    try {
      await tauriInvoke('delete_price_list', { id: list.id });
      setSelectedList(null);
      loadAll();
    } catch (e) { setError(String(e)); }
  };

  const saveItem = async (productId: number) => {
    if (!selectedList) return;
    const price = parsePersianNumber(pendingItems[productId]);
    if (isNaN(price) || pendingItems[productId] === '' || pendingItems[productId] === undefined) return;
    try {
      await tauriInvoke('upsert_price_list_item', { priceListId: selectedList, productId, price });
      setPendingItems((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      const updated = await tauriInvoke<PriceListItem[]>('get_price_list_items', { priceListId: selectedList });
      setItems(updated);
    } catch (e) { setError(String(e)); }
  };

  const removeItem = async (id: number) => {
    try {
      await tauriInvoke('delete_price_list_item', { id });
      if (selectedList) {
        const updated = await tauriInvoke<PriceListItem[]>('get_price_list_items', { priceListId: selectedList });
        setItems(updated);
      }
    } catch (e) { setError(String(e)); }
  };

  const currentList = lists.find((l) => l.id === selectedList) || null;
  const itemsByProduct = new Map(items.map((i) => [i.productId, i]));
  const filteredProducts = products.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${p.name} ${p.code || ''}`.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="لیست قیمت"
        description="تعریف چند لیست قیمت فروش و خرید و اعمال قیمت‌گذاری متفاوت برای مشتریان و تأمین‌کنندگان"
        icon={<Tags className="w-5 h-5" />}
        breadcrumb="عملیات / لیست قیمت"
        actions={
          <>
            <Button variant="outline" onClick={() => loadAll()}>
              <RefreshCw className="w-4 h-4" /> بروزرسانی
            </Button>
            <Button onClick={() => setListModal(true)}>
              <Plus className="w-4 h-4" /> لیست جدید
            </Button>
          </>
        }
      />

      {error && (
        <div className="bg-rose-50 text-rose-700 text-sm rounded-xl px-4 py-3 border border-rose-200">{error}</div>
      )}

      {/* Lists */}
      <div className="flex flex-wrap gap-2">
        {lists.map((list) => (
          <div key={list.id} className="relative">
            <button
              onClick={() => setSelectedList(list.id)}
              className={`rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all border ${
                selectedList === list.id
                  ? 'bg-brand-50 text-brand-800 border-brand-300 ring-2 ring-brand-500/20'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {list.name}
              <span className="mr-2 text-[11px] font-medium">
                <Badge tone={list.type === 'sale' ? 'green' : 'blue'}>{list.type === 'sale' ? 'فروش' : 'خرید'}</Badge>
              </span>
              {list.isDefault && <Star className="w-3.5 h-3.5 inline mr-1 text-amber-500 fill-amber-400" />}
            </button>
            <button
              onClick={() => deleteList(list)}
              className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center hover:bg-rose-600 shadow-sm"
              title="حذف لیست"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        {lists.length === 0 && (
          <Card className="w-full">
            <EmptyState
              icon={<Tags className="w-7 h-7" />}
              title="لیست قیمتی تعریف نشده"
              description="برای هر گروه مشتری (تکی، عمده، نمایندگی و...) یک لیست قیمت جداگانه تعریف کنید."
              action={<Button onClick={() => setListModal(true)}><Plus className="w-4 h-4" /> ساخت لیست قیمت</Button>}
            />
          </Card>
        )}
      </div>

      {/* Items */}
      {currentList && (
        <Card
          title={`قیمت‌ها — ${currentList.name}`}
          description={`لیست قیمت ${currentList.type === 'sale' ? 'فروش' : 'خرید'} ${currentList.isDefault ? '(پیش‌فرض)' : ''}`}
          icon={<Package className="w-4 h-4" />}
        >
          <SearchInput value={search} onChange={setSearch} placeholder="جستجوی کالا..." className="w-64 mb-4" />
          {filteredProducts.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">کالایی یافت نشد.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-card w-full">
                <thead>
                  <tr>
                    <th>کد</th><th>نام کالا</th><th>قیمت فعلی</th><th>قیمت این لیست</th><th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => {
                    const item = itemsByProduct.get(p.id);
                    const pending = pendingItems[p.id];
                    const shownPrice = pending !== undefined ? Number(pending) : item?.price;
                    return (
                      <tr key={p.id}>
                        <td className="font-mono text-xs text-slate-400">{p.code || '—'}</td>
                        <td className="font-bold">{p.name}</td>
                        <td className="ltr-force text-slate-500">{formatMoney(p.salePrice ?? 0)}</td>
                        <td className="w-48">
                          <Input
                            type="text"
                            inputMode="decimal"
                            persianNumbers
                            value={shownPrice ?? ''}
                            placeholder={item ? String(item.price) : 'قیمت...'}
                            onChange={(e) => setPendingItems((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            className="text-sm"
                          />
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            {pending !== undefined && (
                              <Button size="sm" onClick={() => saveItem(p.id)}>
                                <Save className="w-3.5 h-3.5" /> ذخیره
                              </Button>
                            )}
                            {item && pending === undefined && (
                              <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-slate-400 mt-3">
            {formatNumber(items.length)} کالا در این لیست قیمت‌گذاری شده است.
          </p>
        </Card>
      )}

      {/* Create list modal */}
      <Modal
        open={listModal}
        onClose={() => setListModal(false)}
        title="لیست قیمت جدید"
        footer={
          <>
            <Button variant="outline" onClick={() => setListModal(false)}>انصراف</Button>
            <Button onClick={createList}>ایجاد لیست</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="نام لیست">
            <Input value={listForm.name} onChange={(e) => setListForm({ ...listForm, name: e.target.value })} placeholder="مثلاً قیمت عمده" />
          </Field>
          <Field label="نوع">
            <select
              value={listForm.type}
              onChange={(e) => setListForm({ ...listForm, type: e.target.value as 'sale' | 'purchase' })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            >
              <option value="sale">فروش</option>
              <option value="purchase">خرید</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={listForm.isDefault}
              onChange={(e) => setListForm({ ...listForm, isDefault: e.target.checked })}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            لیست پیش‌فرض این نوع باشد
          </label>
        </div>
      </Modal>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}
