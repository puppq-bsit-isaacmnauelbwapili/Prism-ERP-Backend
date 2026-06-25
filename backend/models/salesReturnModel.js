import pool from '../database/db.js';

const generateReturnNumber = () => {
  const timestamp = Date.now().toString().slice(-8);
  return `SR-${timestamp}`;
};

export const getAllReturns = async () => {
  const [rows] = await pool.query(
    'SELECT * FROM sales_returns ORDER BY return_date DESC'
  );
  return rows;
};

export const getReturnById = async (id) => {
  const [returnRows] = await pool.query(
    'SELECT * FROM sales_returns WHERE return_id = ?',
    [id]
  );
  if (returnRows.length === 0) return null;

  const [items] = await pool.query(
    `SELECT sri.*, soi.product_id, p.product_name
     FROM sales_return_items sri
     JOIN sales_order_items soi ON sri.order_item_id = soi.order_item_id
     JOIN products p ON soi.product_id = p.product_id
     WHERE sri.return_id = ?`,
    [id]
  );

  return { ...returnRows[0], items };
};

// Creates a new return request for items belonging to an existing order.
// Validates that the returned quantity doesn't exceed what was originally ordered,
// and computes the refund amount from the original line prices.
export const createReturn = async (data) => {
  const { order_id, reason, items } = data;
  // items = [{ order_item_id, quantity }, ...]

  if (!order_id || !items || items.length === 0) {
    throw new Error('order_id and at least one item are required');
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const orderItemIds = items.map((i) => i.order_item_id);
    const [orderItems] = await connection.query(
      `SELECT * FROM sales_order_items WHERE order_item_id IN (?) AND order_id = ?`,
      [orderItemIds, order_id]
    );

    if (orderItems.length !== orderItemIds.length) {
      throw new Error('One or more items do not belong to this order');
    }

    const itemMap = new Map(orderItems.map((i) => [i.order_item_id, i]));

    let refundAmount = 0;
    const lineItems = items.map((item) => {
      const orderItem = itemMap.get(item.order_item_id);

      if (!item.quantity || item.quantity <= 0 || item.quantity > orderItem.quantity) {
        throw new Error(`Invalid return quantity for item ${item.order_item_id}`);
      }

      const subtotal = Number(orderItem.unit_price) * item.quantity;
      refundAmount += subtotal;

      return { order_item_id: item.order_item_id, quantity: item.quantity, subtotal };
    });

    const returnNumber = generateReturnNumber();

    const [returnResult] = await connection.query(
      `INSERT INTO sales_returns (return_number, order_id, reason, refund_amount, status)
       VALUES (?, ?, ?, ?, 'Pending')`,
      [returnNumber, order_id, reason || null, refundAmount]
    );
    const returnId = returnResult.insertId;

    for (const line of lineItems) {
      await connection.query(
        `INSERT INTO sales_return_items (return_id, order_item_id, quantity, subtotal)
         VALUES (?, ?, ?, ?)`,
        [returnId, line.order_item_id, line.quantity, line.subtotal]
      );
    }

    await connection.commit();
    return returnId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Updates a return's status. When moving to 'Refunded', restocks the
// returned quantities back into the products table.
export const updateReturnStatus = async (id, status) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [returnRows] = await connection.query(
      'SELECT * FROM sales_returns WHERE return_id = ?',
      [id]
    );
    if (returnRows.length === 0) throw new Error('Return not found');

    await connection.query(
      'UPDATE sales_returns SET status = ? WHERE return_id = ?',
      [status, id]
    );

    // Restock only happens once, when transitioning into 'Refunded'
    if (status === 'Refunded' && returnRows[0].status !== 'Refunded') {
      const [items] = await connection.query(
        `SELECT sri.quantity, soi.product_id
         FROM sales_return_items sri
         JOIN sales_order_items soi ON sri.order_item_id = soi.order_item_id
         WHERE sri.return_id = ?`,
        [id]
      );

      for (const item of items) {
        await connection.query(
          'UPDATE products SET stock_quantity = stock_quantity + ? WHERE product_id = ?',
          [item.quantity, item.product_id]
        );
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};