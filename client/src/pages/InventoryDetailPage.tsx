import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getInventoryCheck } from '../api/inventory';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, LoadingState } from '../components/StateViews';
import { btnSecondary, cardClass, tableHeadClass, tdClass, thClass } from '../components/ui';
import { formatDateTime } from '../lib/format';
import { useAsyncData } from '../lib/useAsyncData';

export function InventoryDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const loadCheck = useCallback(() => getInventoryCheck(id), [id]);
  const { data: check, error, loading, reload } = useAsyncData(loadCheck);

  return (
    <div>
      <PageHeader
        title={check ? `Opname: ${check.checkNumber}` : 'Detail Opname'}
        actions={
          <Link to="/inventory" className={btnSecondary}>
            Kembali
          </Link>
        }
      />

      {loading && !check && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {check && (
        <div className="space-y-6">
          <div className={`${cardClass} p-5 grid grid-cols-2 gap-4 md:flex md:gap-10`}>
            <div>
              <p className="text-sm text-slate-500">Pemeriksa</p>
              <p className="font-semibold text-slate-900">{check.checkedBy}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Tanggal</p>
              <p className="font-semibold text-slate-900">{formatDateTime(check.checkedAt)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Status</p>
              <p className="font-semibold text-slate-900">{check.status === 'APPLIED' ? 'SELESAI' : check.status}</p>
            </div>
            {check.notes && (
              <div>
                <p className="text-sm text-slate-500">Catatan</p>
                <p className="font-medium text-slate-900">{check.notes}</p>
              </div>
            )}
          </div>

          <div className={`${cardClass} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className={tableHeadClass}>
                  <tr>
                    <th className={thClass}>Produk</th>
                    <th className={`${thClass} text-right`}>Stok Sistem</th>
                    <th className={`${thClass} text-right`}>Stok Fisik</th>
                    <th className={`${thClass} text-right`}>Selisih</th>
                    <th className={thClass}>Alasan</th>
                    <th className={thClass}>Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {check.items.map((item) => {
                    const diffColor = item.difference > 0 ? 'text-green-600 font-medium' : item.difference < 0 ? 'text-red-600 font-medium' : 'text-slate-500';
                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className={tdClass}>
                          <div className="font-medium text-slate-900">{item.productName}</div>
                          <div className="text-xs text-slate-500">{item.productSku}</div>
                        </td>
                        <td className={`${tdClass} text-right`}>{item.systemStock}</td>
                        <td className={`${tdClass} text-right font-semibold`}>{item.physicalStock}</td>
                        <td className={`${tdClass} text-right ${diffColor}`}>
                          {item.difference > 0 ? '+' : ''}{item.difference}
                        </td>
                        <td className={tdClass}>{item.reason}</td>
                        <td className={tdClass}>{item.notes || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
