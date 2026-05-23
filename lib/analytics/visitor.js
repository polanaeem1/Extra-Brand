export function getVisitorId() {
  const key = 'extra_visitor_id';
  try {
    let visitorId = localStorage.getItem(key);
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem(key, visitorId);
    }
    return visitorId;
  } catch {
    return crypto.randomUUID();
  }
}

