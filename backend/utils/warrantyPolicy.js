export const WARRANTY_TYPES = {
  REPLACE: 'replace',
  REPAIR: 'repair',
  MANUFACTURER: 'manufacturer',
  INITIAL_EXCHANGE: 'initial_exchange',
  NONE: 'none'
};

const defaultConditions = {
  charger:
    'Bảo hành lỗi không nhận sạc, sạc chập chờn, không ra điện, lỗi cổng nếu không gãy hoặc đứt.',
  wiredHeadphone:
    'Bảo hành lỗi một bên không nghe, mic lỗi, rè âm, nút bấm lỗi trong điều kiện sử dụng bình thường.',
  wirelessHeadphone:
    'Bảo hành lỗi Bluetooth, một bên không nhận, hộp sạc lỗi, không lên nguồn, pin tụt bất thường.',
  wirelessCharger: 'Bảo hành lỗi không sạc, sạc chập chờn hoặc không nhận thiết bị.',
  powerBank:
    'Bảo hành lỗi không sạc vào, không sạc ra, tụt pin bất thường, lỗi cổng sạc nếu không gãy hoặc vào nước.',
  bluetoothAccessory: 'Bảo hành lỗi remote Bluetooth, nút chụp hoặc lỗi kết nối.',
  ledLight: 'Bảo hành lỗi không sáng, lỗi sạc hoặc lỗi nút bật/tắt.',
  glass: 'Chỉ đổi lỗi trong ngày nếu sai mẫu, lỗi keo, nứt/vỡ sẵn trước khi dùng hoặc lỗi do nhân viên dán.',
  case: 'Chỉ đổi lỗi 7 ngày nếu sai mẫu, lỗi form, lỗi nút bấm, nứt/gãy sẵn khi nhận.',
  ppf: 'Chỉ xử lý tại thời điểm dán nếu sai mẫu, lỗi keo hoặc dán lỗi do nhân viên.',
  initialAccessory: 'Chỉ đổi lỗi 7 ngày nếu có lỗi sản xuất ban đầu.',
  none: 'Sản phẩm không áp dụng bảo hành.'
};

const defaultExclusions = {
  power: 'Không nhận bảo hành khi sản phẩm gãy, đứt, cháy nổ, biến dạng, vào nước hoặc có dấu hiệu cạy mở.',
  physical: 'Không nhận bảo hành trầy xước, rơi vỡ, vào nước, hao mòn hoặc lỗi phát sinh do sử dụng sai cách.',
  glass: 'Không bảo hành sau khi đã dán, đã sử dụng, rơi vỡ, trầy xước hoặc tự bóc dán lại.',
  case: 'Không bảo hành trầy xước, ố màu, giãn form, hao mòn hoặc hư hỏng do sử dụng.',
  none: 'Không áp dụng tiếp nhận bảo hành.'
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
    warranty_enabled: enabled ? 1 : 0,
    warranty_period_days: Number(days || 0),
    warranty_type: type,
    warranty_conditions: conditions,
    warranty_exclusions: exclusions,
    warranty_note: note
  };
}

export function getDefaultWarrantyPolicy(product = {}) {
  const text = normalizeText(`${product.name || ''} ${product.category_name || ''} ${product.category || ''}`);

  if (hasAny(text, ['popsocket', 'popsockets', 'day moc', 'moc khoa', 've sinh man hinh', 'bo ve sinh'])) {
    return makePolicy({
      enabled: false,
      days: 0,
      type: WARRANTY_TYPES.NONE,
      conditions: defaultConditions.none,
      exclusions: defaultExclusions.none,
      note: 'Không bảo hành, kiểm tra ngoại quan trước khi giao khách.'
    });
  }

  if (hasAny(text, ['ppf', 'mieng dan lung', 'dan lung', 'mat lung'])) {
    return makePolicy({
      enabled: false,
      days: 0,
      type: WARRANTY_TYPES.INITIAL_EXCHANGE,
      conditions: defaultConditions.ppf,
      exclusions: defaultExclusions.glass,
      note: 'Nên tách hoặc map riêng nhóm Miếng dán PPF / Miếng dán lưng để tránh áp chính sách phụ kiện tiện ích.'
    });
  }

  if (hasAny(text, ['kinh cuong luc', 'cuong luc', 'kinh camera', 'camera glass'])) {
    return makePolicy({
      enabled: false,
      days: 1,
      type: WARRANTY_TYPES.INITIAL_EXCHANGE,
      conditions: defaultConditions.glass,
      exclusions: defaultExclusions.glass,
      note: 'Chỉ đổi lỗi trong ngày, kiểm tra trước và sau khi dán.'
    });
  }

  if (hasAny(text, ['op lung', 'case', 'chong soc'])) {
    return makePolicy({
      enabled: false,
      days: 7,
      type: WARRANTY_TYPES.INITIAL_EXCHANGE,
      conditions: defaultConditions.case,
      exclusions: defaultExclusions.case,
      note: 'Không bảo hành chính thức, chỉ đổi lỗi ban đầu trong 7 ngày.'
    });
  }

  if (hasAny(text, ['tui chong nuoc', 'gia do', 'kep dien thoai', 'kep o to', 'oto', 'o to'])) {
    return makePolicy({
      enabled: false,
      days: 7,
      type: WARRANTY_TYPES.INITIAL_EXCHANGE,
      conditions: defaultConditions.initialAccessory,
      exclusions: defaultExclusions.physical,
      note: 'Chỉ đổi lỗi sản xuất ban đầu trong 7 ngày.'
    });
  }

  if (hasAny(text, ['sac du phong', 'power bank', 'pin du phong'])) {
    return makePolicy({
      enabled: true,
      days: 180,
      type: WARRANTY_TYPES.REPAIR,
      conditions: defaultConditions.powerBank,
      exclusions: defaultExclusions.power,
      note: 'Bảo hành 180 ngày theo tem và tình trạng ngoại quan.'
    });
  }

  if (hasAny(text, ['tai nghe bluetooth', 'true wireless', 'khong day', 'airpods', 'tws'])) {
    return makePolicy({
      enabled: true,
      days: 180,
      type: WARRANTY_TYPES.REPAIR,
      conditions: defaultConditions.wirelessHeadphone,
      exclusions: defaultExclusions.physical,
      note: 'Bảo hành 180 ngày cho lỗi điện tử, pin và kết nối.'
    });
  }

  if (hasAny(text, ['tai nghe', 'earphone', 'headphone'])) {
    return makePolicy({
      enabled: true,
      days: 90,
      type: WARRANTY_TYPES.REPLACE,
      conditions: defaultConditions.wiredHeadphone,
      exclusions: defaultExclusions.physical,
      note: 'Bảo hành 90 ngày cho lỗi âm thanh, mic và nút bấm.'
    });
  }

  if (hasAny(text, ['de sac khong day', 'sac khong day', 'wireless charger', 'qi'])) {
    return makePolicy({
      enabled: true,
      days: 90,
      type: WARRANTY_TYPES.REPAIR,
      conditions: defaultConditions.wirelessCharger,
      exclusions: defaultExclusions.power,
      note: 'Bảo hành 90 ngày cho lỗi nhận sạc.'
    });
  }

  if (hasAny(text, ['gay selfie', 'tripod', 'remote bluetooth'])) {
    return makePolicy({
      enabled: true,
      days: 30,
      type: WARRANTY_TYPES.REPLACE,
      conditions: defaultConditions.bluetoothAccessory,
      exclusions: defaultExclusions.physical,
      note: 'Bảo hành 30 ngày cho lỗi remote hoặc kết nối.'
    });
  }

  if (hasAny(text, ['den led', 'livestream', 'ring light'])) {
    return makePolicy({
      enabled: true,
      days: 30,
      type: WARRANTY_TYPES.REPAIR,
      conditions: defaultConditions.ledLight,
      exclusions: defaultExclusions.power,
      note: 'Bảo hành 30 ngày cho lỗi nguồn, sạc hoặc nút bật/tắt.'
    });
  }

  if (hasAny(text, ['bo sac', 'cu sac', 'sac nhanh', 'cap sac', 'cable', 'adapter', 'charger'])) {
    return makePolicy({
      enabled: true,
      days: 90,
      type: WARRANTY_TYPES.REPLACE,
      conditions: defaultConditions.charger,
      exclusions: defaultExclusions.power,
      note: 'Bảo hành 90 ngày cho lỗi sạc, không áp dụng khi đứt gãy hoặc cháy nổ.'
    });
  }

  return makePolicy({
    enabled: false,
    days: 0,
    type: WARRANTY_TYPES.NONE,
    conditions: defaultConditions.none,
    exclusions: defaultExclusions.none,
    note: 'Chưa xác định chính sách, nhân viên cần kiểm tra trước khi bán.'
  });
}

export function normalizeWarrantyPolicy(body = {}, fallbackProduct = {}) {
  const defaults = getDefaultWarrantyPolicy(fallbackProduct);
  const type = body.warranty_type ?? defaults.warranty_type;
  const enabled = Boolean(Number(body.warranty_enabled ?? defaults.warranty_enabled));
  const periodDays = Number(body.warranty_period_days ?? defaults.warranty_period_days ?? 0);

  return {
    warranty_enabled: enabled ? 1 : 0,
    warranty_period_days: Number.isFinite(periodDays) && periodDays >= 0 ? periodDays : 0,
    warranty_type: type,
    warranty_conditions: body.warranty_conditions ?? defaults.warranty_conditions,
    warranty_exclusions: body.warranty_exclusions ?? defaults.warranty_exclusions,
    warranty_note: body.warranty_note ?? defaults.warranty_note
  };
}

export function getWarrantyDisplayLabel(policy = {}) {
  if (policy.warranty_type === WARRANTY_TYPES.INITIAL_EXCHANGE) return 'Chỉ đổi lỗi ban đầu';
  if (!Number(policy.warranty_enabled)) return 'Không bảo hành';
  return 'Có bảo hành';
}
