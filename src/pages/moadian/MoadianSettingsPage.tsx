/**
 * Moadian Tax-API Settings Page
 *
 * Lets the user:
 *   - Configure their fiscal memory ID + economic code
 *   - Toggle production vs sandbox
 *   - Upload their private key (.key / .pem) + certificate (.crt /
 *     .cer) — encrypted with a passphrase and stored at rest in
 *     <data>/moadian/credentials.enc
 *   - Test the connection (calls GET_SERVER_INFORMATION)
 *   - View the server's public keys (needed to actually send)
 *
 * Once configured, the user can send invoices from the invoices
 * page (per-invoice "ارسال به مودیان" button).
 */

import { useEffect, useRef, useState } from 'react';
import {
  Key,
  ShieldCheck,
  Upload,
  Trash2,
  RefreshCw,
  Save,
  Server,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { tauriInvoke } from '../../lib/tauri';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { toPersianNumber } from '../../lib/persian-number';
import type {
  MoadianConfig,
  MoadianServerInfo,
} from '../../types/database';

export function MoadianSettingsPage() {
  const [config, setConfig] = useState<MoadianConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Form fields
  const [fiscalId, setFiscalId] = useState('');
  const [economicCode, setEconomicCode] = useState('');
  const [useSandbox, setUseSandbox] = useState(true);

  // Credentials upload
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [passphraseConfirm, setPassphraseConfirm] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [certificate, setCertificate] = useState('');
  const privateKeyFileRef = useRef<HTMLInputElement>(null);
  const certFileRef = useRef<HTMLInputElement>(null);

  // Test result
  const [serverInfo, setServerInfo] = useState<MoadianServerInfo | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const cfg = await tauriInvoke<MoadianConfig>('get_moadian_config');
      setConfig(cfg);
      setFiscalId(cfg.fiscalId);
      setEconomicCode(cfg.economicCode);
      setUseSandbox(cfg.useSandbox);
    } catch (err) {
      setFeedback({ type: 'error', message: `خطا در بارگذاری: ${err}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleSaveConfig = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const cfg = await tauriInvoke<MoadianConfig>('save_moadian_config', {
        fiscalId,
        economicCode,
        useSandbox,
      });
      setConfig(cfg);
      setFeedback({
        type: 'success',
        message: 'تنظیمات سامانه مودیان ذخیره شد.',
      });
    } catch (err) {
      setFeedback({ type: 'error', message: `خطا در ذخیره: ${err}` });
    } finally {
      setBusy(false);
    }
  };

  const handleTestConnection = async () => {
    if (!passphrase) {
      setFeedback({
        type: 'error',
        message:
          'برای تست اتصال، گذرواژه کلید خصوصی را وارد کنید (کلید خصوصی بارگذاری نشده؟)',
      });
      return;
    }
    setBusy(true);
    setFeedback({ type: 'info', message: 'در حال تست اتصال به سامانه مودیان...' });
    try {
      const info = await tauriInvoke<MoadianServerInfo>(
        'test_moadian_connection',
        { passphrase },
      );
      setServerInfo(info);
      setFeedback({
        type: 'success',
        message: `اتصال موفق. زمان سرور: ${info.serverTime || '—'}. ${toPersianNumber(info.publicKeys.length)} کلید عمومی دریافت شد.`,
      });
    } catch (err) {
      setFeedback({ type: 'error', message: `خطا در اتصال: ${err}` });
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const handleFile = async (
    file: File,
    setter: (s: string) => void,
  ): Promise<string> => {
    const text = await file.text();
    setter(text);
    return text;
  };

  const handleUpload = async () => {
    if (passphrase.length < 6) {
      setFeedback({
        type: 'error',
        message: 'گذرواژه باید حداقل ۶ کاراکتر باشد.',
      });
      return;
    }
    if (passphrase !== passphraseConfirm) {
      setFeedback({ type: 'error', message: 'گذرواژه و تکرار آن یکسان نیستند.' });
      return;
    }
    if (!privateKey.trim() || !certificate.trim()) {
      setFeedback({
        type: 'error',
        message: 'هر دو فایل کلید خصوصی و گواهی باید بارگذاری شوند.',
      });
      return;
    }
    setBusy(true);
    setFeedback({ type: 'info', message: 'در حال رمزگذاری و ذخیره...' });
    try {
      await tauriInvoke('save_moadian_credentials', {
        privateKeyPem: privateKey,
        certificatePem: certificate,
        passphrase,
      });
      setShowUploadForm(false);
      setPrivateKey('');
      setCertificate('');
      setPassphrase('');
      setPassphraseConfirm('');
      setFeedback({
        type: 'success',
        message:
          'کلید خصوصی و گواهی با موفقیت ذخیره شدند. اکنون می‌توانید به سامانه مودیان فاکتور ارسال کنید.',
      });
      await refresh();
    } catch (err) {
      setFeedback({ type: 'error', message: `خطا در ذخیره: ${err}` });
    } finally {
      setBusy(false);
    }
  };

  const handleClearCredentials = async () => {
    if (
      !window.confirm(
        'آیا از حذف کلید خصوصی و گواهی اطمینان دارید؟ این عملیات غیرقابل بازگشت است.',
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await tauriInvoke('clear_moadian_credentials');
      setFeedback({
        type: 'success',
        message: 'کلید خصوصی و گواهی حذف شدند.',
      });
      await refresh();
    } catch (err) {
      setFeedback({ type: 'error', message: `خطا در حذف: ${err}` });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-slate-500">در حال بارگذاری...</div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-brand">
            <Server className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">تنظیمات سامانه مودیان</h1>
            <p className="text-[12px] text-slate-400">ارسال صورتحساب الکترونیکی به سازمان مالیاتی</p>
          </div>
        </div>
        <Button
          onClick={refresh}
          variant="secondary"
          disabled={loading || busy}
          className="flex items-center gap-1.5"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          به‌روزرسانی
        </Button>
      </div>

      {feedback && (
        <div
          className={`mb-4 p-4 rounded-lg flex items-start gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : feedback.type === 'error'
                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
          ) : feedback.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          ) : (
            <Server className="w-5 h-5 mt-0.5 flex-shrink-0" />
          )}
          <p className="text-sm whitespace-pre-line">{feedback.message}</p>
        </div>
      )}

      {/* Configuration form */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" />
          اطلاعات شناسایی
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              شناسه یکتای حافظه مالیاتی (fiscalId)
            </label>
            <Input
              value={fiscalId}
              onChange={(e) => setFiscalId(e.target.value)}
              placeholder="مثلاً A1B2C3"
              maxLength={6}
              className="font-mono"
            />
            <p className="text-xs text-slate-500 mt-1">
              ۶ کاراکتر. از کارپوشه مالیاتی دریافت می‌شود.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              کد اقتصادی (tins)
            </label>
            <Input
              value={economicCode}
              onChange={(e) => setEconomicCode(e.target.value)}
              placeholder="مثلاً ۱۴۰۰۱۲۳۴۵۶۷"
            />
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useSandbox}
                onChange={(e) => setUseSandbox(e.target.checked)}
                className="rounded"
              />
              <span>استفاده از محیط تست (sandbox)</span>
            </label>
            <p className="text-xs text-slate-500 mt-1">
              در حالت sandbox، درخواست‌ها به سرور تست سامانه مودیان ارسال می‌شوند.
              برای ارسال واقعی، این گزینه را خاموش کنید.
            </p>
          </div>
        </div>
        <Button
          onClick={handleSaveConfig}
          disabled={busy}
          className="flex items-center gap-1.5"
        >
          <Save className="w-4 h-4" />
          ذخیره تنظیمات
        </Button>
      </div>

      {/* Credentials */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Key className="w-5 h-5" />
            کلید خصوصی و گواهی
          </h2>
          <div className="flex items-center gap-2">
            {config?.hasCredentials && (
              <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                بارگذاری شده
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          کلید خصوصی شما با PBKDF2 + AES-256-GCM روی دیسک رمز می‌شود.
          هیچ متن ساده‌ای روی دیسک ذخیره نمی‌شود. گذرواژه را فراموش نکنید —
          بدون آن امکان ارسال فاکتور وجود ندارد.
        </p>
        <div className="flex items-center gap-2">
          {!showUploadForm && (
            <Button
              onClick={() => setShowUploadForm(true)}
              variant="secondary"
              disabled={busy}
              className="flex items-center gap-1.5"
            >
              <Upload className="w-4 h-4" />
              {config?.hasCredentials ? 'جایگزینی' : 'بارگذاری'} کلید و گواهی
            </Button>
          )}
          {config?.hasCredentials && (
            <Button
              onClick={handleClearCredentials}
              variant="secondary"
              disabled={busy}
              className="flex items-center gap-1.5 text-rose-600"
            >
              <Trash2 className="w-4 h-4" />
              حذف
            </Button>
          )}
        </div>

        {showUploadForm && (
          <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  فایل کلید خصوصی (.key / .pem)
                </label>
                <input
                  ref={privateKeyFileRef}
                  type="file"
                  accept=".key,.pem"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f, setPrivateKey);
                  }}
                  className="block w-full text-sm text-slate-600 file:ml-2 file:px-3 file:py-1 file:rounded file:border-0 file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  فایل گواهی (.crt / .cer / .pem)
                </label>
                <input
                  ref={certFileRef}
                  type="file"
                  accept=".crt,.cer,.pem"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f, setCertificate);
                  }}
                  className="block w-full text-sm text-slate-600 file:ml-2 file:px-3 file:py-1 file:rounded file:border-0 file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  گذرواژه برای رمزگذاری روی دیسک
                </label>
                <Input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="حداقل ۶ کاراکتر"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  تکرار گذرواژه
                </label>
                <Input
                  type="password"
                  value={passphraseConfirm}
                  onChange={(e) => setPassphraseConfirm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleUpload}
                disabled={busy}
                className="flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                رمزگذاری و ذخیره
              </Button>
              <Button
                onClick={() => {
                  setShowUploadForm(false);
                  setPrivateKey('');
                  setCertificate('');
                  setPassphrase('');
                  setPassphraseConfirm('');
                }}
                variant="secondary"
                disabled={busy}
              >
                <X className="w-4 h-4" />
                انصراف
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Test connection */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Server className="w-5 h-5" />
          تست اتصال
        </h2>
        <p className="text-sm text-slate-600 mb-3">
          برای تست اتصال، کلید خصوصی و گواهی باید بارگذاری شده باشند و
          گذرواژه را اینجا وارد کنید. تست، درخواست
          <code className="bg-slate-100 px-1 rounded mx-1" dir="ltr">
            GET_SERVER_INFORMATION
          </code>
          را به سامانه مودیان ارسال می‌کند.
        </p>
        <div className="flex items-center gap-2 mb-4">
          <Button
            onClick={handleTestConnection}
            disabled={busy || !config?.hasCredentials}
            className="flex items-center gap-1.5"
          >
            <Server className="w-4 h-4" />
            تست اتصال
          </Button>
        </div>

        {serverInfo && (
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-2">
              نتیجه تست اتصال
            </h3>
            <div className="text-sm space-y-1">
              <div>
                <span className="text-slate-500">زمان سرور:</span>{' '}
                <code dir="ltr">{serverInfo.serverTime || '—'}</code>
              </div>
              <div>
                <span className="text-slate-500">تعداد کلیدهای عمومی:</span>{' '}
                {toPersianNumber(serverInfo.publicKeys.length)}
              </div>
              {serverInfo.publicKeys.length > 0 && (
                <div className="mt-2">
                  <details>
                    <summary className="cursor-pointer text-primary-600 text-sm">
                      مشاهده اولین کلید عمومی (برای ارسال فاکتور لازم است)
                    </summary>
                    <textarea
                      readOnly
                      value={serverInfo.publicKeys[0].keyPem}
                      className="w-full mt-2 p-2 text-xs font-mono bg-white border border-slate-200 rounded"
                      rows={8}
                      dir="ltr"
                    />
                  </details>
                </div>
              )}
            </div>
          </div>
        )}

        {config?.lastTestAt && (
          <p className="text-xs text-slate-500 mt-3">
            آخرین تست موفق: <code dir="ltr">{config.lastTestAt}</code>
          </p>
        )}
        {config?.lastError && (
          <p className="text-xs text-rose-600 mt-1">
            آخرین خطا: {config.lastError}
          </p>
        )}
      </div>

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" />
          راهنمای اتصال به سامانه مودیان
        </h4>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal pr-5">
          <li>
            به{' '}
            <code className="bg-white px-1 rounded" dir="ltr">
              my.tax.gov.ir
            </code>{' '}
            وارد شوید و شناسه یکتای حافظه مالیاتی + کلید عمومی خود را
            بارگذاری کنید.
          </li>
          <li>
            کلید خصوصی (PKCS#8 PEM) و گواهی دیجیتال (X.509) را از مرکز
            میانی معتبر دریافت کنید.
          </li>
          <li>
            شناسه یکتای حافظه مالیاتی + کد اقتصادی را در بالا وارد
            کنید، سپس کلید را بارگذاری کنید.
          </li>
          <li>
            تست اتصال را بزنید تا کلید عمومی سرور دریافت شود (برای
            ارسال واقعی فاکتور لازم است).
          </li>
          <li>
            در صفحه فاکتورها، دکمه «ارسال به مودیان» برای هر فاکتور
            فعال می‌شود.
          </li>
        </ol>
      </div>
    </div>
  );
}