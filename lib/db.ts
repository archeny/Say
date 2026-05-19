// by Stenly
import mysql from 'mysql2/promise';

declare global {
  var _mysqlPool: mysql.Pool | undefined;
}

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'overchat_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

export const pool = globalThis._mysqlPool || mysql.createPool(config);

if (process.env.NODE_ENV !== 'production') {
  globalThis._mysqlPool = pool;
}
