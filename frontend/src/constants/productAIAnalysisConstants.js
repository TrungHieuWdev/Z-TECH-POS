export const ANALYSIS_PERIODS = [7, 15, 30];
export const PRODUCT_CATEGORIES = ['Ốp lưng', 'Kính cường lực', 'Miếng dán PPF', 'Thiết bị sạc', 'Tai nghe', 'Loa Bluetooth', 'Giá đỡ điện thoại', 'Phụ kiện chụp ảnh', 'Phụ kiện vệ sinh', 'Phụ kiện tiện ích', 'Phụ kiện khác'];
export const PHONE_BRANDS = [{ value: 'apple', label: 'Apple' }, { value: 'samsung', label: 'Samsung' }, { value: 'vivo', label: 'Vivo' }, { value: 'oppo', label: 'Oppo' }, { value: 'xiaomi', label: 'Xiaomi' }];
export const ALERT_LEVELS = [{ value: 'high', label: 'Cao' }, { value: 'medium', label: 'Trung bình' }, { value: 'low', label: 'Thấp' }];
export const ALERT_META = {
  high: { label: 'Cao', suggestedDiscount: 10, suggestion: 'Tạo khuyến mãi giảm khoảng 10% và tạm hạn chế nhập thêm.' },
  medium: { label: 'Trung bình', suggestedDiscount: 5, suggestion: 'Cân nhắc ưu đãi khoảng 5% và theo dõi thêm tốc độ bán.' },
  low: { label: 'Thấp', suggestedDiscount: 0, suggestion: 'Tiếp tục theo dõi, chưa bắt buộc tạo khuyến mãi.' }
};
