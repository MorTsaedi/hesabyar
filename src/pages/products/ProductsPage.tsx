import { useState, useEffect } from 'react';
import type { Product, StockStatusRow, ValuationRow } from '../../types/database';
import { tauriInvoke } from '../../lib/tauri';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PackagePlus, Search, Edit, Trash2, X, BarChart3, AlertTriangle, Layers } from 'lucide-react';

type Tab = 'products' | 'stock-status' | 'valuation';

export function ProductsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    unit: '',
    purchasePrice: '',
    salePrice: '',
    description: '',
    minStock: '',
    maxStock: '',
    reorderPoint: '',
    quantity: '',
    taxRate: '',
  });

  // Stock status
  const [stockStatus, setStockStatus] = useState<StockStatusRow[]>([]);
  const [valuation, setValuation] = useState<ValuationRow[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [valuationMethod, setValuationMethod] = useState<string>('wac');
  const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const fetchProducts = async () => {
    try {
      setLoading(true);
      if (searchQuery.trim()) {
        const result: Product[] = await tauriInvoke('search_products', { query: searchQuery });
        setProducts(result);
      } else {
        const result: Product[] = await tauriInvoke('get_products');
        setProducts(result);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'products') {
      fetchProducts();
    } else if (activeTab === 'stock-status') {
      loadStockStatus();
    } else if (activeTab === 'valuation') {
      loadValuation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, searchQuery]);

  const loadStockStatus = async () => {
    try {
      setLoading(true);
      const method = await tauriInvoke<string>('get_inventory_method', {});
      const [status, lowStock] = await Promise.all([
        tauriInvoke<StockStatusRow[]>('get_stock_status_report', { company_id: 1, method }),
        tauriInvoke<Product[]>('get_low_stock_products', { company_id: 1 }),
      ]);
      setStockStatus(status);
      setLowStockProducts(lowStock);
    } catch (error) {
      console.error('Failed to load stock status:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadValuation = async () => {
    try {
      setLoading(true);
      const method = await tauriInvoke<string>('get_inventory_method', {});
      setValuationMethod(method);
      const result = await tauriInvoke<ValuationRow[]>('get_inventory_valuation', {
        method,
      });
      setValuation(result);
    } catch (error) {
      console.error('Failed to load valuation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdate = async () => {
    try {
      const purchasePrice = formData.purchasePrice ? parseFloat(formData.purchasePrice) || 0 : 0;
      const salePrice = formData.salePrice ? parseFloat(formData.salePrice) || 0 : 0;
      const minStock = formData.minStock ? parseInt(formData.minStock) || 0 : 0;
      const maxStock = formData.maxStock ? parseInt(formData.maxStock) || 0 : 0;
      const reorderPoint = formData.reorderPoint ? parseInt(formData.reorderPoint) || 0 : 0;
      const quantity = formData.quantity ? parseFloat(formData.quantity) || 0 : 0;
      const taxRate = formData.taxRate ? parseFloat(formData.taxRate) || 0 : 0;

      if (editingProduct) {
        await tauriInvoke('update_product', {
          id: editingProduct.id,
          product_type: 'product',
          name: formData.name,
          code: formData.code || null,
          unit: formData.unit || null,
          purchase_price: purchasePrice,
          sale_price: salePrice,
          description: formData.description || null,
          min_stock: minStock,
          max_stock: maxStock,
          reorder_point: reorderPoint,
        });
      } else {
        await tauriInvoke('create_product', {
          product_type: 'product',
          name: formData.name,
          code: formData.code || null,
          unit: formData.unit || null,
          purchase_price: purchasePrice,
          sale_price: salePrice,
          description: formData.description || null,
          min_stock: minStock,
          max_stock: maxStock,
          reorder_point: reorderPoint,
          quantity,
          tax_rate: taxRate,
        });
      }

      resetForm();
      await fetchProducts();
    } catch (error) {
      console.error('Failed to save product:', error);
      alert('خطا در ذخیره محصول: ' + error);
    }
  };

  const handleDelete = (product: Product) => {
    setDeleteConfirm(product);
    setDeleteError('');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    try {
      await tauriInvoke('delete_product', { id: deleteConfirm.id });
      setDeleteConfirm(null);
      await fetchProducts();
      alert('محصول با موفقیت حذف شد.');
    } catch (error) {
      console.error('Delete product error:', error);
      setDeleteError(String(error));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      unit: '',
      purchasePrice: '',
      salePrice: '',
      description: '',
      minStock: '',
      maxStock: '',
      reorderPoint: '',
      quantity: '',
      taxRate: '',
    });
    setEditingProduct(null);
    setShowForm(false);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      code: product.code || '',
      unit: product.unit || '',
      purchasePrice: product.purchasePrice?.toString() || '',
      salePrice: product.salePrice?.toString() || '',
      description: product.description || '',
      minStock: product.minStock?.toString() || '',
      maxStock: product.maxStock?.toString() || '',
      reorderPoint: product.reorderPoint?.toString() || '',
      quantity: '',
      taxRate: product.taxRate?.toString() || '',
    });
    setShowForm(true);
  };

  const statusStyle = (status: string) => {
    switch (status) {
      case 'low_stock': return 'bg-rose-100 text-rose-700';
      case 'overstock': return 'bg-amber-100 text-amber-700';
      case 'normal': return 'bg-emerald-100 text-emerald-700';
      case 'inactive': return 'bg-slate-100 text-slate-500';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'low_stock': return 'کمبود موجودی';
      case 'overstock': return 'موجودی اضافه';
      case 'normal': return 'عادی';
      case 'inactive': return 'غیرفعال';
      default: return status;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-brand">
            <PackagePlus className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">مدیریت کالاها و خدمات</h1>
            <p className="text-[12px] text-slate-400">کاتالوگ کالا، انبار و قیمت‌گذاری</p>
          </div>
        </div>
        {activeTab === 'products' && (
          <Button onClick={() => {
            setEditingProduct(null);
            setFormData({
              name: '',
              code: '',
              unit: '',
              purchasePrice: '',
              salePrice: '',
              description: '',
              minStock: '',
              maxStock: '',
              reorderPoint: '',
              quantity: '',
              taxRate: '',
            });
            setShowForm(true);
          }} className="flex items-center gap-2">
            <PackagePlus className="w-4 h-4" />
            کالا/خدمت جدید
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white border border-slate-200 rounded-lg p-1 flex gap-1 mb-6">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors flex-1 ${
            activeTab === 'products' ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-4 h-4" />
          کالاها
        </button>
        <button
          onClick={() => setActiveTab('stock-status')}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors flex-1 ${
            activeTab === 'stock-status' ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          وضعیت موجودی
        </button>
        <button
          onClick={() => setActiveTab('valuation')}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors flex-1 ${
            activeTab === 'valuation' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          ارزش موجودی
        </button>
      </div>

      {/* Search (products tab only) */}
      {activeTab === 'products' && (
        <div className="mb-6">
          <div className="relative">
            <Input
              type="text"
              placeholder="جستجو در کالاها و خدمات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          </div>
        </div>
      )}

      {/* ===== PRODUCTS TAB ===== */}
      {activeTab === 'products' && (
        <>
          {showForm && (
            <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">
                  {editingProduct ? 'ویرایش کالا/خدمت' : 'کالا/خدمت جدید'}
                </h3>
                <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">نام</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">کد</label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">واحد</label>
                  <Input
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">قیمت خرید</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                    persianNumbers
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">قیمت فروش</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formData.salePrice}
                    onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                    persianNumbers
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">موجودی اولیه</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    persianNumbers
                  />
                  <p className="text-xs text-slate-400 mt-1">فقط برای محصولات جدید</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">حداقل موجودی</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                    persianNumbers
                  />
                  <p className="text-xs text-slate-400 mt-1">هشدار در صورت کمتر از این مقدار</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">حداکثر موجودی</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formData.maxStock}
                    onChange={(e) => setFormData({ ...formData, maxStock: e.target.value })}
                    persianNumbers
                  />
                  <p className="text-xs text-slate-400 mt-1">هشدار در صورت بیشتر از این مقدار</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">نقطه سفارش</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formData.reorderPoint}
                    onChange={(e) => setFormData({ ...formData, reorderPoint: e.target.value })}
                    persianNumbers
                  />
                  <p className="text-xs text-slate-400 mt-1">توصیه به سفارش مجدد</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">مالیات / VAT (%)</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formData.taxRate}
                    onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                    persianNumbers
                  />
                  <p className="text-xs text-slate-400 mt-1">نرخ مالیات بر ارزش افزوده</p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-600 mb-1">توضیحات</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="توضیحات اضافی"
                  className="w-full p-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={handleCreateOrUpdate} className="flex items-center gap-2">
                  {editingProduct ? 'ذخیره تغییرات' : 'افزودن کالا/خدمت'}
                </Button>
                <Button onClick={resetForm} variant="secondary">
                  لغو
                </Button>
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-6 text-center text-slate-500">در حال بارگذاری...</div>
            ) : products.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                <p>کالا یا خدمتی یافت نشد</p>
                <p className="text-sm mt-2">از دکمه "کالا/خدمت جدید" برای افزودن استفاده کنید</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-3 text-right font-semibold text-slate-700">کد</th>
                      <th className="p-3 text-right font-semibold text-slate-700">نام</th>
                      <th className="p-3 text-right font-semibold text-slate-700">واحد</th>
                      <th className="p-3 text-right font-semibold text-slate-700">موجودی</th>
                      <th className="p-3 text-right font-semibold text-slate-700">قیمت خرید</th>
                      <th className="p-3 text-right font-semibold text-slate-700">قیمت فروش</th>
                      <th className="p-3 text-right font-semibold text-slate-700">حداقل</th>
                      <th className="p-3 text-right font-semibold text-slate-700">حداکثر</th>
                      <th className="p-3 text-center font-semibold text-slate-700">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-3 font-mono text-xs text-slate-500">{product.code || '-'}</td>
                        <td className="p-3 text-slate-800">{product.name}</td>
                        <td className="p-3 text-slate-600">{product.unit || '-'}</td>
                        <td className="p-3 text-slate-700 font-medium">{product.currentStock !== undefined ? product.currentStock.toLocaleString('fa-IR') : '۰'}</td>
                        <td className="p-3 text-slate-700 ltr-force">{product.purchasePrice?.toLocaleString('fa-IR') || '۰'}</td>
                        <td className="p-3 text-slate-700 ltr-force">{product.salePrice?.toLocaleString('fa-IR') || '۰'}</td>
                        <td className="p-3">
                          {product.minStock !== undefined && product.minStock > 0 ? (
                            <span className="text-xs text-slate-600">{product.minStock}</span>
                          ) : '-'}
                        </td>
                        <td className="p-3">
                          {product.maxStock !== undefined && product.maxStock > 0 ? (
                            <span className="text-xs text-slate-600">{product.maxStock}</span>
                          ) : '-'}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(product)}
                              className="text-primary-600 hover:text-primary-800 p-1"
                              title="ویرایش"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(product)}
                              className="text-rose-500 hover:text-rose-700 p-1"
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== STOCK STATUS TAB ===== */}
      {activeTab === 'stock-status' && (
        <div className="space-y-6">
          {/* Low Stock Alert */}
          {lowStockProducts.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h3 className="font-semibold text-rose-800">هشدار کمبود موجودی</h3>
              </div>
              <p className="text-sm text-rose-600 mb-2">
                {lowStockProducts.length} محصول کمتر از حداقل موجودی خود هستند
              </p>
              <div className="flex flex-wrap gap-2">
                {lowStockProducts.map((p) => (
                  <span key={p.id} className="inline-flex items-center gap-1 bg-white text-rose-700 text-xs px-2 py-1 rounded border border-rose-200">
                    {p.name}
                    {p.minStock !== undefined && ` (حداقل: ${p.minStock})`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-slate-500">
              در حال بارگذاری...
            </div>
          ) : stockStatus.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-slate-500">
              هیچ محصولی یافت نشد
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">نام</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">کد</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">موجودی فعلی</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">حداقل</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">حداکثر</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">نقطه سفارش</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">ارزش</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">وضعیت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockStatus.map((row) => (
                      <tr key={row.productId} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-slate-800">{row.name}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{row.code || '-'}</td>
                        <td className="px-4 py-2.5 font-medium">{row.currentQty}</td>
                        <td className="px-4 py-2.5 text-slate-600">{row.minStock || '-'}</td>
                        <td className="px-4 py-2.5 text-slate-600">{row.maxStock || '-'}</td>
                        <td className="px-4 py-2.5 text-slate-600">{row.reorderPoint || '-'}</td>
                        <td className="px-4 py-2.5 ltr-force">{row.totalValue.toLocaleString('fa-IR')}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-block text-xs px-2 py-1 rounded-full ${statusStyle(row.status)}`}>
                            {statusLabel(row.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== VALUATION TAB ===== */}
      {activeTab === 'valuation' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                ارزش موجودی به روش {valuationMethod === 'wac' ? 'میانگین وزنی' : valuationMethod === 'fifo' ? 'FIFO' : valuationMethod}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={loadValuation}
            >
              بروزرسانی
            </Button>
          </div>

          {loading ? (
            <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-slate-500">
              در حال بارگذاری...
            </div>
          ) : valuation.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-slate-500">
              هیچ موجودی یافت نشد
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">نام</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">کد</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">واحد</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">تعداد</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">قیمت واحد</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">ارزش کل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {valuation.map((row) => (
                      <tr key={row.productId} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-slate-800">{row.name}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{row.code || '-'}</td>
                        <td className="px-4 py-2.5 text-slate-600">{row.unit || '-'}</td>
                        <td className="px-4 py-2.5 font-medium">{row.quantity}</td>
                        <td className="px-4 py-2.5 ltr-force">{row.averageCost.toLocaleString('fa-IR')}</td>
                        <td className="px-4 py-2.5 font-bold ltr-force">{row.totalValue.toLocaleString('fa-IR')}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                      <td colSpan={3} className="px-4 py-3 text-right text-sm text-slate-700">جمع کل</td>
                      <td className="px-4 py-3">{valuation.reduce((s, r) => s + r.quantity, 0)}</td>
                      <td></td>
                      <td className="px-4 py-3 ltr-force">
                        {valuation.reduce((s, r) => s + r.totalValue, 0).toLocaleString('fa-IR')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-full">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">حذف کالا/خدمت</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              آیا از حذف <strong>{deleteConfirm.name}</strong> اطمینان دارید؟
            </p>
            {deleteError && (
              <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">
                {deleteError}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                بله، حذف شود
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
