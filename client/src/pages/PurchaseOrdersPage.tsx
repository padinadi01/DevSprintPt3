import { Link } from 'react-router-dom';
import { getPurchaseOrders } from '../api/purchase-orders';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, LoadingState } from '../components/StateViews';
import { formatDateTime } from '../lib/format';
import { useAsyncData } from '../lib/useAsyncData';
import { useAuth } from '../lib/auth';

export function PurchaseOrdersPage() {
  const { isPemilik, hasPermission } = useAuth();
  const canCreatePo = isPemilik || hasPermission('CREATE_PO');
  const { data: pos, error, loading, reload } = useAsyncData(getPurchaseOrders);

  const content = (
    <div className="bg-white rounded shadow overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="p-3 font-medium text-gray-500">Tanggal</th>
            <th className="p-3 font-medium text-gray-500">Supplier</th>
            <th className="p-3 font-medium text-gray-500">Status</th>
            <th className="p-3 font-medium text-gray-500">Catatan</th>
            <th className="p-3 font-medium text-gray-500 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {pos?.map((po) => (
            <tr key={po.id} className="border-b last:border-0 hover:bg-gray-50">
              <td className="p-3">{formatDateTime(po.orderDate)}</td>
              <td className="p-3 font-medium">{po.supplierName}</td>
              <td className="p-3">
                <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                  {po.status}
                </span>
              </td>
              <td className="p-3 text-gray-500">{po.note || '-'}</td>
              <td className="p-3 text-right">
                <Link
                  to={`/pesanan/${po.id}`}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                >
                  Lihat Detail & Terima
                </Link>
              </td>
            </tr>
          ))}
          {pos?.length === 0 && (
            <tr>
              <td colSpan={5} className="p-6 text-center text-gray-500">
                Belum ada pesanan.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pesanan Pembelian (PO)"
        description="Kelola pesanan ke supplier sebelum barang datang."
        actions={
          canCreatePo ? (
            <Link
              to="/pesanan/baru"
              className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 transition-colors"
            >
              Buat Pesanan
            </Link>
          ) : undefined
        }
      />
      {loading && !pos && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {pos && content}
    </div>
  );
}
