import { Router } from 'express';
import { dashboardRouter } from './dashboard.routes';
import { inventoryRouter } from './inventory.routes';
import { productRouter } from './product.routes';
import { restockRouter } from './restock.routes';
import { saleRouter } from './sale.routes';
import { stockRouter } from './stock.routes';
import { supplierRouter } from './supplier.routes';

// Everything below is mounted under /api (see app.ts).
export const apiRouter = Router();

apiRouter.use('/products', productRouter);
apiRouter.use('/sales', saleRouter);
apiRouter.use('/suppliers', supplierRouter);
apiRouter.use('/restock-orders', restockRouter);
apiRouter.use('/inventory-checks', inventoryRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/', stockRouter); // /stock-adjustments and /stock-movements
