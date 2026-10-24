import { Router } from 'express';
import { authRouter } from './auth.routes';
import { dashboardRouter } from './dashboard.routes';
import { goodsReceiptRouter } from './goods-receipt.routes';
import { productRouter } from './product.routes';
import { purchaseOrderRouter } from './purchase-order.routes';
import { receiverRouter } from './receiver.routes';
import { saleRouter } from './sale.routes';
import { stockRouter } from './stock.routes';
import { supplierRouter } from './supplier.routes';

// Everything below is mounted under /api (see app.ts).
export const apiRouter = Router();

// Public & Session routes
apiRouter.use('/auth', authRouter);

// Protected routes
apiRouter.use('/products', productRouter);
apiRouter.use('/purchase-orders', purchaseOrderRouter);
apiRouter.use('/goods-receipts', goodsReceiptRouter);
apiRouter.use('/receivers', receiverRouter);
apiRouter.use('/suppliers', supplierRouter);
apiRouter.use('/sales', saleRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/stock', stockRouter); // /stock/movements and /stock/adjustments
apiRouter.use('/', stockRouter); // /stock-adjustments and /stock-movements


