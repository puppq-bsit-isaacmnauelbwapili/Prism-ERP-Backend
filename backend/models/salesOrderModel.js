import pool from '../database/db.js';

export const getAllOrders = async () => {
  const [rows] = await pool.query('SELECT * FROM sales_orders ORDER BY order_date DESC');
  return rows;
};

export const getOrderById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM sales_orders WHERE order_id = ?', [id]);
  return rows[0];
};

export const createOrder = async (data) => {
  const { customer_name, total_amount, status } = data;
  const [result] = await pool.query(
    'INSERT INTO sales_orders (customer_name, order_date, total_amount, status) VALUES (?, NOW(), ?, ?)',
    [customer_name, total_amount, status]
  );
  return result;
};

export const updateOrderStatus = async (id, status) => {
  const [result] = await pool.query(
    'UPDATE sales_orders SET status = ? WHERE order_id = ?',
    [status, id]
  );
  return result;
};

export const deleteOrder = async (id) => {
  const [result] = await pool.query('DELETE FROM sales_orders WHERE order_id = ?', [id]);
  return result;
};