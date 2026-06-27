const FULL_ACCESS_ROLES = new Set(['owner', 'manager', 'admin']);
const STAFF_PERMISSIONS = new Set(['dashboard:view_own_shift','sale:create','promotion:apply','product:view','inventory:view','inventory:report_issue','customer:view','customer:create','customer:update','invoice:view_own','invoice:print','shift:start','shift:end','shift:view_own','promotion:view','warranty:lookup','warranty:create_ticket','warranty:update_basic_status','ai:suggest']);

export const PATH_PERMISSIONS = {'/':'dashboard:view_own_shift','/pos':'sale:create','/products':'product:view','/inventory':'inventory:view','/customers':'customer:view','/orders':'invoice:view_own','/shifts':'shift:view_own','/promotions':'promotion:view','/warranties':'warranty:lookup','/reports':'report:view','/categories':'category:manage','/suppliers':'supplier:manage','/employees':'employee:manage','/activity-logs':'activity_log:view','/settings':'settings:manage'};

export function hasPermission(role, permissionKey) {
  return FULL_ACCESS_ROLES.has(String(role || '').toLowerCase()) || STAFF_PERMISSIONS.has(permissionKey);
}
export function canAccessRoute(pathname, role) {
  const path = Object.keys(PATH_PERMISSIONS).sort((a,b)=>b.length-a.length).find((item)=>pathname===item || (item!=='/' && pathname.startsWith(`${item}/`)));
  return path ? hasPermission(role, PATH_PERMISSIONS[path]) : false;
}
