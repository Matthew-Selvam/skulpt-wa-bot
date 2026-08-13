// services/analytics.js - Aggregations over existing Order/Client data.
//
// All of this is derivable from records the bot already writes; nothing new
// needed to be tracked.
import { Order } from "../models/Order.js";
import { Client } from "../models/Client.js";

/** Revenue and order count per day for the last `days` days (paid orders). */
export async function revenueByDay(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await Order.aggregate([
    { $match: { status: "paid", createdAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        revenue: { $sum: "$total" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Fill gaps so the chart doesn't imply activity on days with no orders
  const byDate = new Map(rows.map((r) => [r._id, r]));
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const row = byDate.get(d);
    out.push({ date: d, revenue: row?.revenue || 0, orders: row?.orders || 0 });
  }
  return out;
}

/** Best-selling trophies by units, across paid orders. */
export async function topTrophies(limit = 10) {
  return Order.aggregate([
    { $match: { status: "paid" } },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.name",
        units: { $sum: 1 },
        revenue: { $sum: "$items.price" },
      },
    },
    { $sort: { units: -1 } },
    { $limit: limit },
    { $project: { _id: 0, name: "$_id", units: 1, revenue: 1 } },
  ]);
}

/** How many paying customers came back for a second order. */
export async function repeatCustomerRate() {
  const rows = await Order.aggregate([
    { $match: { status: "paid" } },
    { $group: { _id: "$userId", orders: { $sum: 1 } } },
  ]);
  const total = rows.length;
  const repeat = rows.filter((r) => r.orders > 1).length;
  return {
    customers: total,
    repeatCustomers: repeat,
    // Guard against 0/0 -> NaN when there are no paid orders yet
    repeatRate: total ? Math.round((repeat / total) * 1000) / 10 : 0,
  };
}

/** Order counts by status, including statuses with zero orders. */
export async function ordersByStatus() {
  const rows = await Order.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const out = { pending: 0, paid: 0, cancelled: 0 };
  for (const r of rows) out[r._id] = r.count;
  return out;
}

/** Headline totals for the dashboard tiles. */
export async function summary() {
  const [paid, revenueAgg, clients, repeat] = await Promise.all([
    Order.countDocuments({ status: "paid" }),
    Order.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    Client.countDocuments(),
    repeatCustomerRate(),
  ]);
  const totalRevenue = revenueAgg[0]?.total || 0;
  return {
    paidOrders: paid,
    totalRevenue,
    averageOrderValue: paid ? Math.round(totalRevenue / paid) : 0,
    clients,
    ...repeat,
  };
}

export async function fullReport({ days = 30 } = {}) {
  const [sum, revenue, trophies, statuses] = await Promise.all([
    summary(),
    revenueByDay(days),
    topTrophies(),
    ordersByStatus(),
  ]);
  return { summary: sum, revenueByDay: revenue, topTrophies: trophies, ordersByStatus: statuses };
}
