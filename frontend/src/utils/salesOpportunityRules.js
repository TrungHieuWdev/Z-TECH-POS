export function buildSalesOpportunities(data) {
  const products = new Map((data.products || []).map((p) => [Number(p.id), p]));
  const totalOrders = Math.max(1, Number(data.orderCount || 0));
  const ideas = [];
  for (const pair of data.pairs || []) {
    const a = products.get(Number(pair.product_a_id)); const b = products.get(Number(pair.product_b_id));
    if (!a || !b) continue;
    const together = Number(pair.together_orders); const base = Number(a.order_count) >= Number(b.order_count) ? a : b; const addon = base === a ? b : a;
    const confidence = together / Math.max(1, Number(base.order_count));
    const lift = together * totalOrders / Math.max(1, Number(a.order_count) * Number(b.order_count));
    if (confidence < 0.12 || lift < 1.05) continue;
    const addonSlow = Number(addon.stock_quantity) > 20 && Number(addon.sold_quantity) < Number(addon.stock_quantity) * .25;
    const giftSafe = Number(addon.cost_price) > 0 && Number(addon.cost_price) <= Math.max(0, Number(base.price) - Number(base.cost_price)) * .45;
    const type = addonSlow && giftSafe ? 'buy_get' : 'combo';
    ideas.push({ id: `${a.id}-${b.id}`, type, base, addon, together, confidence, lift, score: confidence * lift * Math.log2(together + 1), discount: type === 'combo' ? (confidence >= .35 ? 10 : 7) : 100,
      title: type === 'buy_get' ? `Mua ${base.name} tặng ${addon.name}` : `Combo ${base.name} + ${addon.name}`,
      reason: `${together} hóa đơn mua chung; ${(confidence * 100).toFixed(0)}% khách mua ${base.name} có mua thêm ${addon.name}. Mức liên quan ${lift.toFixed(1)}× so với ngẫu nhiên.`,
      goal: type === 'buy_get' ? 'Dùng sản phẩm bán tốt để giải phóng hàng tồn chậm' : 'Tăng giá trị trung bình mỗi hóa đơn' });
  }
  for (const p of products.values()) if (Number(p.stock_quantity) > 35 && Number(p.sold_quantity) >= 3) ideas.push({ id: `tier-${p.id}`, type: 'tier', base: p, score: Number(p.stock_quantity) / Math.max(1, Number(p.sold_quantity)), title: `Mua nhiều ${p.name} tiết kiệm hơn`, reason: `Kho còn ${p.stock_quantity} sản phẩm, kỳ phân tích bán ${p.sold_quantity}. Khuyến khích khách mua nhiều trong một lần.`, goal: 'Tăng số lượng bán trên mỗi hóa đơn', discount: 5 });
  return ideas.sort((x, y) => y.score - x.score).slice(0, 20);
}
