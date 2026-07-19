import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { getToken, getUser, isFullAccessRole, logout } from '../utils/auth';

const ADMIN_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const STAFF_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const WARNING_BEFORE_LOGOUT_MS = 60 * 1000;
const ACTIVITY_THROTTLE_MS = 1000;

const ACTIVITY_EVENTS = [
  'pointerdown',
  'keydown',
  'touchstart',
  'scroll'
];

export default function SessionSecurity() {
  const lastActivityRef = useRef(Date.now());
  const lastRecordedActivityRef = useRef(0);
  const warningShownRef = useRef(false);

  useEffect(() => {
    const recordActivity = () => {
      const now = Date.now();

      if (now - lastRecordedActivityRef.current < ACTIVITY_THROTTLE_MS) {
        return;
      }

      lastRecordedActivityRef.current = now;
      lastActivityRef.current = now;
      warningShownRef.current = false;
      toast.dismiss('idle-session-warning');
    };

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, recordActivity, { passive: true });
    }

    const interval = window.setInterval(() => {
      if (!getToken()) {
        lastActivityRef.current = Date.now();
        return;
      }

      const user = getUser();
      const idleTimeout = isFullAccessRole(user?.role)
        ? ADMIN_IDLE_TIMEOUT_MS
        : STAFF_IDLE_TIMEOUT_MS;
      const idleDuration = Date.now() - lastActivityRef.current;

      if (idleDuration >= idleTimeout) {
        toast.dismiss('idle-session-warning');
        logout();
        return;
      }

      if (
        idleDuration >= idleTimeout - WARNING_BEFORE_LOGOUT_MS &&
        !warningShownRef.current
      ) {
        warningShownRef.current = true;
        toast.error('Phiên làm việc sẽ tự động đăng xuất sau 1 phút nếu không có thao tác.', {
          id: 'idle-session-warning',
          duration: WARNING_BEFORE_LOGOUT_MS
        });
      }
    }, 15 * 1000);

    return () => {
      window.clearInterval(interval);

      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, recordActivity);
      }
    };
  }, []);

  return null;
}
