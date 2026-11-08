// Date helpers used across the API.
function timeAgo(date, now = new Date()) {
  const days = Math.floor((now - date) / 86400000);
  if (days === 0) return "aujourd'hui";
  return `il y a ${days} jour${days > 1 ? 's' : ''}`;
}
module.exports = { timeAgo };
