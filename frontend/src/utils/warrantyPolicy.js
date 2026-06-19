export const warrantyTypes = {
  replace: 'Đổi mới',
  repair: 'Sửa chữa',
  manufacturer: 'Gửi hãng',
  initial_exchange: 'Chỉ đổi lỗi ban đầu',
  none: 'Không bảo hành'
};

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function hasAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function makePolicy({ enabled, days, type, conditions, exclusions, note }) {
  return {
    warranty_enabled: enabled,
    warranty_period_days: days,
    warranty_type: type,
    warranty_conditions: conditions,
    warranty_exclusions: exclusions,
    warranty_note: note
  };
}

export function getDefaultWarrantyPolicy(product = {}) {
  const text = normalizeText(`${product.name || ''} ${product.category_name || ''}`);

  if (hasAny(text, ['popsocket', 'popsockets', 'day moc', 'moc khoa', 've sinh man hinh', 'bo ve sinh'])) {
    return makePolicy({
      enabled: false,
      days: 0,
      type: 'none',
      conditions: 'Sản phẩm không áp dụng bảo hành.',
      exclusions: 'Không áp dụng tiếp nhận bảo hành.',
      note: 'Không bảo hành, kiểm tra ngoại quan trước khi giao khách.'
    });
  }

  if (hasAny(text, ['ppf', 'mieng dan lung', 'dan lung', 'mat lung'])) {
    return makePolicy({
      enabled: false,
      days: 0,
      type: 'initial_exchange',
      conditions: 'Chỉ xử lý tại thời điểm dán nếu sai mẫu, lỗi keo hoặc dán lỗi do nhân viên.',
      exclusions: 'Không bảo hành sau khi đã dán, đã sử dụng, rơi vỡ, trầy xước hoặc tự bóc dán lại.',
      note: 'Nên map riêng nhóm Miếng dán PPF / Miếng dán lưng, không dùng chung chính sách Phụ kiện tiện ích.'
    });
  }

  if (hasAny(text, ['kinh cuong luc', 'cuong luc', 'kinh camera'])) {
    return makePolicy({
      enabled: false,
      days: 1,
      type: 'initial_exchange',
      conditions: 'Chỉ đổi lỗi trong ngày nếu sai mẫu, lỗi keo, nứt/vỡ sẵn trước khi dùng hoặc lỗi do nhân viên dán.',
      exclusions: 'Không bảo hành sau khi đã dán, đã sử dụng, rơi vỡ, trầy xước hoặc tự bóc dán lại.',
      note: 'Chỉ đổi lỗi trong ngày, kiểm tra trước và sau khi dán.'
    });
  }

  if (hasAny(text, ['op lung', 'case', 'chong soc'])) {
    return makePolicy({
      enabled: false,
      days: 7,
      type: 'initial_exchange',
      conditions: 'Chỉ đổi lỗi 7 ngày nếu sai mẫu, lỗi form, lỗi nút bấm, nứt/gãy sẵn khi nhận.',
      exclusions: 'Không bảo hành trầy xước, ố màu, giãn form, hao mòn hoặc hư hỏng do sử dụng.',
      note: 'Không bảo hành chính thức, chỉ đổi lỗi ban đầu trong 7 ngày.'
    });
  }

  if (hasAny(text, ['tui chong nuoc', 'gia do', 'kep dien thoai', 'kep o to', 'oto', 'o to'])) {
    return makePolicy({
      enabled: false,
      days: 7,
      type: 'initial_exchange',
      conditions: 'Chỉ đổi lỗi 7 ngày nếu có lỗi sản xuất ban đầu.',
      exclusions: 'Không nhận đổi khi trầy xước, rơi vỡ, vào nước, hao mòn hoặc sử dụng sai cách.',
      note: 'Chỉ đổi lỗi sản xuất ban đầu trong 7 ngày.'
    });
  }

  if (hasAny(text, ['sac du phong', 'power bank', 'pin du phong'])) {
    return makePolicy({
      enabled: true,
      days: 180,
      type: 'repair',
      conditions: 'Bảo hành lỗi không sạc vào, không sạc ra, tụt pin bất thường, lỗi cổng sạc nếu không gãy hoặc vào nước.',
      exclusions: 'Không nhận bảo hành khi sản phẩm gãy, đứt, cháy nổ, biến dạng, vào nước hoặc có dấu hiệu cạy mở.',
      note: 'Bảo hành 180 ngày theo tem và tình trạng ngoại quan.'
    });
  }

  if (hasAny(text, ['tai nghe bluetooth', 'true wireless', 'khong day', 'airpods', 'tws'])) {
    return makePolicy({
      enabled: true,
      days: 180,
      type: 'repair',
      conditions: 'Bảo hành lỗi Bluetooth, một bên không nhận, hộp sạc lỗi, không lên nguồn, pin tụt bất thường.',
      exclusions: 'Không nhận bảo hành rơi vỡ, vào nước, hao mòn hoặc lỗi do sử dụng sai cách.',
      note: 'Bảo hành 180 ngày cho lỗi điện tử, pin và kết nối.'
    });
  }

  if (hasAny(text, ['tai nghe', 'earphone', 'headphone'])) {
    return makePolicy({
      enabled: true,
      days: 90,
      type: 'replace',
      conditions: 'Bảo hành lỗi một bên không nghe, mic lỗi, rè âm, nút bấm lỗi.',
      exclusions: 'Không nhận bảo hành rơi vỡ, vào nước, đứt dây hoặc hao mòn do sử dụng.',
      note: 'Bảo hành 90 ngày cho lỗi âm thanh, mic và nút bấm.'
    });
  }

  if (hasAny(text, ['de sac khong day', 'sac khong day', 'wireless charger', 'qi'])) {
    return makePolicy({
      enabled: true,
      days: 90,
      type: 'repair',
      conditions: 'Bảo hành lỗi không sạc, sạc chập chờn hoặc không nhận thiết bị.',
      exclusions: 'Không nhận bảo hành khi cháy nổ, vào nước, cạy mở hoặc biến dạng.',
      note: 'Bảo hành 90 ngày cho lỗi nhận sạc.'
    });
  }

  if (hasAny(text, ['gay selfie', 'tripod', 'remote bluetooth'])) {
    return makePolicy({
      enabled: true,
      days: 30,
      type: 'replace',
      conditions: 'Bảo hành lỗi remote Bluetooth, nút chụp hoặc lỗi kết nối.',
      exclusions: 'Không nhận bảo hành rơi vỡ, gãy khớp, vào nước hoặc hao mòn.',
      note: 'Bảo hành 30 ngày cho lỗi remote hoặc kết nối.'
    });
  }

  if (hasAny(text, ['den led', 'livestream', 'ring light'])) {
    return makePolicy({
      enabled: true,
      days: 30,
      type: 'repair',
      conditions: 'Bảo hành lỗi không sáng, lỗi sạc hoặc lỗi nút bật/tắt.',
      exclusions: 'Không nhận bảo hành khi cháy nổ, vào nước, rơi vỡ hoặc cạy mở.',
      note: 'Bảo hành 30 ngày cho lỗi nguồn, sạc hoặc nút bật/tắt.'
    });
  }

  if (hasAny(text, ['bo sac', 'cu sac', 'sac nhanh', 'cap sac', 'cable', 'adapter', 'charger'])) {
    return makePolicy({
      enabled: true,
      days: 90,
      type: 'replace',
      conditions: 'Bảo hành lỗi không nhận sạc, sạc chập chờn, không ra điện, lỗi cổng nếu không gãy hoặc đứt.',
      exclusions: 'Không nhận bảo hành khi sản phẩm gãy, đứt, cháy nổ, biến dạng, vào nước hoặc có dấu hiệu cạy mở.',
      note: 'Bảo hành 90 ngày cho lỗi sạc, không áp dụng khi đứt gãy hoặc cháy nổ.'
    });
  }

  return makePolicy({
    enabled: false,
    days: 0,
    type: 'none',
    conditions: 'Sản phẩm chưa xác định chính sách bảo hành.',
    exclusions: 'Không áp dụng tiếp nhận bảo hành khi chưa có chính sách rõ ràng.',
    note: 'Nhân viên cần kiểm tra chính sách trước khi bán.'
  });
}

export function getWarrantyLabel(policy = {}) {
  if (policy.warranty_type === 'initial_exchange') return 'Chỉ đổi lỗi ban đầu';
  if (!Boolean(Number(policy.warranty_enabled))) return 'Không bảo hành';
  return 'Có bảo hành';
}
