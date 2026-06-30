import { ALERT_META } from '../../../constants/productAIAnalysisConstants';
const styles = { high: 'bg-red-50 text-red-700 ring-red-200', medium: 'bg-amber-50 text-amber-700 ring-amber-200', low: 'bg-sky-50 text-sky-700 ring-sky-200' };
export default function ProductAlertBadge({ level }) { return <span className={`inline-flex px-2.5 py-1 text-xs font-bold ring-1 ${styles[level]}`}>{ALERT_META[level]?.label}</span>; }
