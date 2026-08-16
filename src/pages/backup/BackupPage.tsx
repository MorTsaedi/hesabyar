/**
 * Backup & Restore Page
 *
 * Provides three operations on the underlying SQLite database:
 *   - Create backup   → writes a snapshot to <data>/backups/<name>.db
 *                        using SQLite's VACUUM INTO.
 *   - Restore backup  → reads user-supplied file bytes, validates the
 *                        SQLite magic header, atomically swaps the live
 *                        DB, and re-runs migrations.
 *   - Delete backup   → removes a backup file from the backups folder.
 *
 * The page also shows database info (path, size, # of backups) and a
 * list of existing backups with per-row delete buttons.
 *
 * The restore flow uses a hidden <input type="file"> for the file
 * picker (no extra dependency required) and reads the bytes via
 * FileReader, which works in Tauri WebView.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Database,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  HardDrive,
  FolderOpen,
} from 'lucide-react';
import { tauriInvoke } from '../../lib/tauri';
import { Button } from '../../components/ui/Button';
import { toPersianNumber } from '../../lib/persian-number';

interface BackupEntry {
  name: string;
  path: string;
  sizeBytes: number;
  modifiedAt: number;
}

interface DatabaseInfo {
  path: string;
  directory: string;
  backupDirectory: string;
  sizeBytes: number;
  backupCount: number;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '۰ بایت';
  const units = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const v = bytes / Math.pow(k, i);
  return `${toPersianNumber(v.toFixed(i === 0 ? 0 : 2))} ${units[i]}`;
}

function formatTimestamp(secs: number): string {
  if (!secs) return '—';
  // Backend gives Unix seconds (local time). Use ISO + toLocaleString
  // so the WebView shows it in the user's locale.
  const d = new Date(secs * 1000);
  const datePart = d.toLocaleDateString('fa-IR');
  const timePart = d.toLocaleTimeString('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return `${datePart} - ${timePart}`;
}

export function BackupPage() {
  const [info, setInfo] = useState<DatabaseInfo | null>(null);
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Restore state
  const [pendingRestore, setPendingRestore] = useState<{
    name: string;
    bytes: Uint8Array;
    sizeBytes: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [dbInfo, list] = await Promise.all([
        tauriInvoke<DatabaseInfo>('get_database_info'),
        tauriInvoke<BackupEntry[]>('list_backups'),
      ]);
      setInfo(dbInfo);
      setBackups(list);
    } catch (err) {
      setFeedback({ type: 'error', message: `خطا در بارگذاری: ${err}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleCreateBackup = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const entry = await tauriInvoke<BackupEntry>('create_backup', {
        name: null,
      });
      setFeedback({
        type: 'success',
        message: `پشتیبان با موفقیت در ${entry.path} ذخیره شد.`,
      });
      await refresh();
    } catch (err) {
      setFeedback({ type: 'error', message: `خطا در ایجاد پشتیبان: ${err}` });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteBackup = async (name: string) => {
    if (
      !window.confirm(
        `آیا از حذف پشتیبان «${name}» اطمینان دارید؟ این عملیات غیرقابل بازگشت است.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await tauriInvoke('delete_backup', { name });
      setFeedback({ type: 'success', message: `پشتیبان «${name}» حذف شد.` });
      await refresh();
    } catch (err) {
      setFeedback({ type: 'error', message: `خطا در حذف: ${err}` });
    } finally {
      setBusy(false);
    }
  };

  const handlePickRestoreFile = () => {
    fileInputRef.current?.click();
  };

  const handleRestoreFileChosen = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    // Reset input so the same file can be picked again later
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    if (
      !window.confirm(
        `بازیابی فایل «${file.name}» جایگزین داده‌های فعلی می‌شود.\n\n` +
          `پیشنهاد می‌شود ابتدا یک پشتیبان از وضعیت فعلی تهیه کنید.\n\n` +
          `آیا ادامه می‌دهید؟`,
      )
    ) {
      return;
    }

    setBusy(true);
    setFeedback({ type: 'info', message: 'در حال خواندن فایل پشتیبان...' });
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      setPendingRestore({
        name: file.name,
        bytes,
        sizeBytes: bytes.length,
      });
      setFeedback({
        type: 'info',
        message: `فایل «${file.name}» (${formatSize(bytes.length)}) آماده بازیابی است. برای تأیید دکمه «بازیابی» را بزنید.`,
      });
    } catch (err) {
      setFeedback({ type: 'error', message: `خطا در خواندن فایل: ${err}` });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestore) return;
    setBusy(true);
    setFeedback({ type: 'info', message: 'در حال بازیابی پایگاه داده...' });
    try {
      // Tauri serializes Uint8Array as a number array, so cast
      // explicitly to a plain array of numbers via Array.from
      const bytesArray = Array.from(pendingRestore.bytes);
      const result = await tauriInvoke<{
        restoredFrom: string;
        safetyCopy: string;
      }>('restore_backup', {
        backup_bytes: bytesArray,
        suggested_name: pendingRestore.name,
      });
      setPendingRestore(null);
      setFeedback({
        type: 'success',
        message:
          `بازیابی با موفقیت انجام شد.\n` +
          `پشتیبان ایمنی (وضعیت قبلی) در این مسیر ذخیره شد:\n${result.safetyCopy}\n\n` +
          `توصیه می‌شود برنامه را مجدداً راه‌اندازی کنید.`,
      });
      await refresh();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: `خطا در بازیابی: ${err}\n\n` +
          'فایل انتخابی یک پایگاه داده معتبر SQLite نیست یا خواندن آن با خطا مواجه شد.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCancelRestore = () => {
    setPendingRestore(null);
    setFeedback(null);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-brand">
            <Database className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">پشتیبان‌گیری و بازیابی</h1>
            <p className="text-[12px] text-slate-400">پشتیبان‌گیری خودکار از اطلاعات</p>
          </div>
        </div>
        <Button
          onClick={refresh}
          variant="secondary"
          disabled={loading || busy}
          className="flex items-center gap-1.5"
        >
          <RefreshCw
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
          />
          به‌روزرسانی
        </Button>
      </div>

      {/* Feedback banner */}
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
            <ShieldCheck className="w-5 h-5 mt-0.5 flex-shrink-0" />
          ) : feedback.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          ) : (
            <Database className="w-5 h-5 mt-0.5 flex-shrink-0" />
          )}
          <p className="text-sm whitespace-pre-line">{feedback.message}</p>
        </div>
      )}

      {/* Database info card */}
      {info && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            اطلاعات پایگاه داده
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-slate-500 mb-1">مسیر فایل اصلی:</div>
              <code className="block bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs break-all" dir="ltr">
                {info.path}
              </code>
            </div>
            <div>
              <div className="text-slate-500 mb-1">پوشه پشتیبان‌ها:</div>
              <code className="block bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs break-all" dir="ltr">
                {info.backupDirectory}
              </code>
            </div>
            <div>
              <div className="text-slate-500 mb-1">حجم فعلی:</div>
              <div className="font-medium text-slate-800">
                {formatSize(info.sizeBytes)}
              </div>
            </div>
            <div>
              <div className="text-slate-500 mb-1">تعداد پشتیبان‌ها:</div>
              <div className="font-medium text-slate-800">
                {toPersianNumber(info.backupCount)} فایل
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Create backup */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="bg-emerald-100 text-emerald-700 p-2 rounded-lg">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">ایجاد پشتیبان</h3>
              <p className="text-sm text-slate-500 mt-1">
                یک کپی امن از تمام اطلاعات شما (شامل حساب‌ها، اسناد،
                فاکتورها، اشخاص و کالاها) در پوشه پشتیبان‌ها ذخیره می‌شود.
              </p>
            </div>
          </div>
          <Button
            onClick={handleCreateBackup}
            disabled={busy || loading}
            className="w-full flex items-center justify-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            تهیه پشتیبان
          </Button>
        </div>

        {/* Restore backup */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="bg-amber-100 text-amber-700 p-2 rounded-lg">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">بازیابی پشتیبان</h3>
              <p className="text-sm text-slate-500 mt-1">
                یک فایل پشتیبان SQLite را انتخاب کنید تا جایگزین
                اطلاعات فعلی شود. وضعیت فعلی به‌طور خودکار در پوشه
                پشتیبان‌ها نگهداری می‌شود.
              </p>
            </div>
          </div>
          <Button
            onClick={handlePickRestoreFile}
            variant="secondary"
            disabled={busy || loading}
            className="w-full flex items-center justify-center gap-1.5"
          >
            <FolderOpen className="w-4 h-4" />
            انتخاب فایل پشتیبان
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".db,.sqlite,.sqlite3"
            onChange={handleRestoreFileChosen}
            className="hidden"
          />
        </div>
      </div>

      {/* Confirm restore */}
      {pendingRestore && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-5 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-amber-700 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-amber-900 mb-1">
                تأیید بازیابی
              </h3>
              <p className="text-sm text-amber-800">
                فایل <code className="font-mono">{pendingRestore.name}</code> (
                {formatSize(pendingRestore.sizeBytes)}) انتخاب شده است.
                پس از تأیید، تمام داده‌های فعلی با محتوای این فایل
                جایگزین خواهند شد. نسخه فعلی به‌طور خودکار در پوشه
                پشتیبان‌ها نگهداری می‌شود تا در صورت نیاز بتوانید به
                آن بازگردید.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleConfirmRestore}
              disabled={busy}
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700"
            >
              <Upload className="w-4 h-4" />
              تأیید و بازیابی
            </Button>
            <Button
              onClick={handleCancelRestore}
              variant="secondary"
              disabled={busy}
            >
              انصراف
            </Button>
          </div>
        </div>
      )}

      {/* Backup list */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Database className="w-5 h-5" />
            فهرست پشتیبان‌ها ({toPersianNumber(backups.length)})
          </h3>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
            در حال بارگذاری...
          </div>
        ) : backups.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Database className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p>هنوز هیچ پشتیبانی تهیه نشده است.</p>
            <p className="text-sm mt-2">
              با کلیک روی دکمه «تهیه پشتیبان» اولین نسخه پشتیبان را
              ایجاد کنید.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-right font-semibold text-slate-700">
                    نام فایل
                  </th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-700">
                    حجم
                  </th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-700">
                    تاریخ
                  </th>
                  <th className="px-4 py-2 text-center font-semibold text-slate-700">
                    عملیات
                  </th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr
                    key={b.name}
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">
                        {b.name}
                      </div>
                      <code
                        className="text-xs text-slate-500 break-all"
                        dir="ltr"
                      >
                        {b.path}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatSize(b.sizeBytes)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatTimestamp(b.modifiedAt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDeleteBackup(b.name)}
                        disabled={busy}
                        className="text-rose-600 hover:text-rose-800 p-1 disabled:opacity-50"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" />
          نکات مهم
        </h4>
        <ul className="text-sm text-blue-800 space-y-1 list-disc pr-5">
          <li>
            پشتیبان‌ها در پوشه{' '}
            <code className="bg-white px-1 rounded" dir="ltr">
              backups/
            </code>{' '}
            کنار فایل اصلی پایگاه داده ذخیره می‌شوند.
          </li>
          <li>
            قبل از بازیابی، یک پشتیبان از وضعیت فعلی به‌طور خودکار
            ساخته می‌شود تا در صورت نیاز بتوانید به آن بازگردید.
          </li>
          <li>
            پس از بازیابی، برنامه را مجدداً راه‌اندازی کنید تا همه
            اطلاعات به‌درستی بارگذاری شوند.
          </li>
          <li>
            فایل‌های پشتیبان با فرمت استاندارد SQLite هستند و با
            ابزارهای دیگر (مثل{' '}
            <code className="bg-white px-1 rounded" dir="ltr">
              sqlite3
            </code>
            ) نیز قابل باز شدن هستند.
          </li>
        </ul>
      </div>
    </div>
  );
}