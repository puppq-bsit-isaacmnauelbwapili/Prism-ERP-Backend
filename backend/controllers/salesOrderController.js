import * as SalesModel from '../models/salesOrderModel.js';

export const getOrders = async (req, res) => {
  try {
    const data = await SalesModel.getAllOrders();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getOrder = async (req, res) => {
  try {
    const data = await SalesModel.getOrderById(req.params.id);
    if (!data) return res.status(404).json({ message: 'Order not found' });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createOrder = async (req, res) => {
  try {
    const result = await SalesModel.createOrder(req.body);
    res.status(201).json({ message: 'Order created', id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    await SalesModel.updateOrderStatus(req.params.id, req.body.status);
    res.status(200).json({ message: 'Order status updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteOrder = async (req, res) => {
  try {
    await SalesModel.deleteOrder(req.params.id);
    res.status(200).json({ message: 'Order deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};