import { Options } from 'http-proxy-middleware';

const buildTarget = (host: string, port: number) => `http://${host}:${port}`;

// Example routing table - adapt hosts/ports for your local setup or docker-compose
export const routes: { path: string; options: Options }[] = [
  {
    path: '/auth',
    options: {
      target: buildTarget(process.env.AUTH_HOST || 'localhost', Number(process.env.AUTH_PORT || 3001)),
      changeOrigin: true
    }
  },
  {
    path: '/inventory',
    options: {
      target: buildTarget(process.env.INVENTORY_HOST || 'localhost', Number(process.env.INVENTORY_PORT || 3002)),
      changeOrigin: true
    }
  },
  {
    path: '/products',
    options: {
      target: buildTarget(process.env.PRODUCT_HOST || 'localhost', Number(process.env.PRODUCT_PORT || 3003)),
      changeOrigin: true
    }
  }
];
