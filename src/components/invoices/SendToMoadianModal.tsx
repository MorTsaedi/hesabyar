/**
 * SendToMoadianModal
 *
 * Modal that lets the user send (or dry-run) an invoice to Moadian.
 *
 * Flow:
 *   1. User picks: dry-run (no network) vs live send
 *   2. User provides the passphrase + server public key (for live)
 *   3. We invoke the corresponding Tauri command
 *   4. Result is shown: for dry-run, the full JSON envelope + every
 *      base64-encoded field; for live, the UID + reference number +
 *      updated moadian_status.
 */

import { useState } from 'react';
import {
  Send,
  FlaskConical,
  X,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Loader2,
} from 'lucide-react';
import { tauriInvoke } from '../../lib/tauri';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import type {
  MoadianDryRun,
  MoadianSendResult,
} from '../../types/database';

interface Props {
  invoiceId: number;
  invoiceNumber: string;
  onClose: () => void;
  onSuccess?: () => void;
}

type Mode = 'dryrun' | 'live';

export function SendToMoadianModal({
  invoiceId,
  invoiceNumber,
  onClose,
  onSuccess,
}: Props) {
  const [mode, setMode] = useState<Mode>('dryrun');
  const [passphrase, setPassphrase] = useState('');
  const [serverPublicKey, setServerPublicKey] = useState('');
  const [productServiceId, setProductServiceId] = useState('0000000000000');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [dryRunResult, setDryRunResult] = useState<MoadianDryRun | null>(null);
  const [sendResult, setSendResult] = useState<MoadianSendResult | null>(null);

  const run = async () => {
    if (!passphrase) {
      setFeedback({ type: 'error', message: 'گذرواژه را وارد کنید.' });
      return;
    }
    if (mode === 'live' && !serverPublicKey.trim()) {
      setFeedback({
        type: 'error',
        message:
          'برای ارسال واقعی، کلید عمومی سرور سامانه مودیان لازم است.',
      });
      return;
    }
    setBusy(true);
    setFeedback({ type: 'info', message: 'در حال ساخت بسته...' });
    setDryRunResult(null);
    setSendResult(null);

    try {
      if (mode === 'dryrun') {
        const result = await tauriInvoke<MoadianDryRun>(
          'dry_run_invoice_packet',
          {
            invoiceId,
            passphrase,
            productServiceId,
          },
        );
        setDryRunResult(result);
        setFeedback({
          type: 'success',
          message:
            'بسته ساخته شد (هیچ درخواستی ارسال نشد). مقادیر زیر را بررسی کنید.',
        });
      } else {
        const result = await tauriInvoke<MoadianSendResult>(
          'send_invoice_to_moadian',
          {
            invoiceId,
            passphrase,
            serverPublicKeyPem: serverPublicKey,
            productServiceId,
          },
        );
        setSendResult(result);
        setFeedback({
          type: 'success',
          message: `فاکتور ارسال شد. کد پیگیری: ${result.referenceNumber}`,
        });
        onSuccess?.();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: `خطا: ${err}` });
    } finally {
      setBusy(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[95vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Send className="w-5 h-5" />
            ارسال فاکتور به سامانه مودیان
            <span className="text-sm text-slate-500 font-mono mr-2">
              #{invoiceNumber}
            </span>
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {feedback && (
            <div
              className={`mb-4 p-3 rounded-lg flex items-start gap-2 text-sm ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : feedback.type === 'error'
                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                    : 'bg-blue-50 text-blue-800 border border-blue-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              ) : feedback.type === 'error' ? (
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              ) : (
                <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" />
              )}
              <p className="whitespace-pre-line">{feedback.message}</p>
            </div>
          )}

          <div className="flex items-center gap-2 mb-4 bg-slate-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => setMode('dryrun')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                mode === 'dryrun'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <FlaskConical className="w-4 h-4" />
              آزمایش (بدون ارسال)
            </button>
            <button
              onClick={() => setMode('live')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                mode === 'live'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <Send className="w-4 h-4" />
              ارسال واقعی
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                گذرواژه کلید خصوصی
              </label>
              <Input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="گذرواژه‌ای که هنگام بارگذاری کلید وارد کردید"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                شناسه کالا/خدمت (sstid)
              </label>
              <Input
                value={productServiceId}
                onChange={(e) => setProductServiceId(e.target.value)}
                placeholder="مثلاً ۲۷۲۰۰۰۰۰۴۴۸۰۱"
              />
              <p className="text-xs text-slate-500 mt-1">
                از سامانه stuffid.tax.gov.ir قابل دریافت است.
              </p>
            </div>
            {mode === 'live' && (
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  کلید عمومی سرور سامانه مودیان
                </label>
                <textarea
                  value={serverPublicKey}
                  onChange={(e) => setServerPublicKey(e.target.value)}
                  placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
                  rows={5}
                  className="w-full p-2 border border-slate-200 rounded-md font-mono text-xs"
                  dir="ltr"
                />
                <p className="text-xs text-slate-500 mt-1">
                  از صفحه تنظیمات مودیان، دکمه «تست اتصال» را بزنید و
                  کلید عمومی سرور را کپی کنید.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={run}
              disabled={busy}
              className={`flex items-center gap-1.5 ${
                mode === 'live'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : ''
              }`}
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === 'live' ? (
                <Send className="w-4 h-4" />
              ) : (
                <FlaskConical className="w-4 h-4" />
              )}
              {mode === 'live' ? 'ارسال به سامانه مودیان' : 'ساخت بسته آزمایشی'}
            </Button>
            <Button onClick={onClose} variant="secondary">
              بستن
            </Button>
          </div>

          {dryRunResult && (
            <div className="mt-6 bg-slate-50 rounded-lg border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-800 mb-3">
                جزئیات بسته ساخته‌شده
              </h3>
              <Field
                label="شناسه یکتای ارسال (uid)"
                value={dryRunResult.uid}
                onCopy={copyToClipboard}
              />
              <Field
                label="URL مقصد"
                value={dryRunResult.wouldSendTo}
                onCopy={copyToClipboard}
                mono
              />
              <JsonField
                label="رشته نرمال‌سازی شده (ورودی امضا)"
                value={dryRunResult.normalizedString}
                onCopy={copyToClipboard}
              />
              <Field
                label="امضای داده (RSA-SHA256)"
                value={dryRunResult.dataSignature}
                onCopy={copyToClipboard}
                mono
              />
              <JsonField
                label="صورتحساب (JSON)"
                value={JSON.stringify(
                  dryRunResult.invoiceJson,
                  null,
                  2,
                )}
                onCopy={copyToClipboard}
              />
              <Field
                label="داده رمز شده (AES-GCM)"
                value={dryRunResult.encryptedData}
                onCopy={copyToClipboard}
                mono
              />
              <Field
                label="برچسب احراز هویت (auth tag)"
                value={dryRunResult.authTag}
                onCopy={copyToClipboard}
                mono
              />
              <Field
                label="کلید متقارن رمز شده (RSA-OAEP)"
                value={dryRunResult.encryptedSymmetricKey}
                onCopy={copyToClipboard}
                mono
              />
              <Field
                label="IV"
                value={dryRunResult.iv}
                onCopy={copyToClipboard}
                mono
              />
              <Field
                label="امضای بسته (envelope)"
                value={dryRunResult.envelopeSignature}
                onCopy={copyToClipboard}
                mono
              />
            </div>
          )}

          {sendResult && (
            <div className="mt-6 bg-emerald-50 rounded-lg border border-emerald-200 p-4">
              <h3 className="font-semibold text-emerald-800 mb-3">
                نتیجه ارسال
              </h3>
              <Field
                label="کد پیگیری (reference number)"
                value={sendResult.referenceNumber}
                onCopy={copyToClipboard}
                mono
              />
              <Field
                label="شناسه یکتا (uid)"
                value={sendResult.uid}
                onCopy={copyToClipboard}
                mono
              />
              <Field
                label="زمان سرور"
                value={String(sendResult.timestampMs)}
                onCopy={copyToClipboard}
                mono
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onCopy: (s: string) => void;
  mono?: boolean;
}

function Field({ label, value, onCopy, mono }: FieldProps) {
  return (
    <div className="mb-2">
      <div className="text-xs font-medium text-slate-600 mb-1">{label}</div>
      <div className="flex items-start gap-2">
        <code
          dir="ltr"
          className={`flex-1 px-2 py-1 bg-white border border-slate-200 rounded text-xs break-all ${
            mono ? 'font-mono' : ''
          }`}
        >
          {value || '—'}
        </code>
        <button
          onClick={() => onCopy(value)}
          className="text-slate-500 hover:text-slate-700 p-1"
          title="کپی"
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

interface JsonFieldProps {
  label: string;
  value: string;
  onCopy: (s: string) => void;
}

function JsonField({ label, value, onCopy }: JsonFieldProps) {
  return (
    <div className="mb-2">
      <div className="text-xs font-medium text-slate-600 mb-1">{label}</div>
      <div className="flex items-start gap-2">
        <textarea
          readOnly
          value={value}
          rows={Math.min(8, value.split('\n').length + 1)}
          dir="ltr"
          className="flex-1 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono"
        />
        <button
          onClick={() => onCopy(value)}
          className="text-slate-500 hover:text-slate-700 p-1"
          title="کپی"
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}