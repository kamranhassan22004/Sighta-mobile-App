export const formatTime = (dateInput) => {
  const date = new Date(dateInput);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const formatDate = (dateInput) => {
  const date = new Date(dateInput);
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};

export const timeAgo = (dateInput) => {
  const seconds = Math.floor((new Date() - new Date(dateInput)) / 1000);

  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes > 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
};

export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const alertTypeLabel = (type) => {
  const map = {
    sos: "SOS Alert",
    low_battery: "Low Battery",
    device_offline: "Device Offline",
    fall_detected: "Fall Detected",
    info: "Info",
  };
  return map[type] || type;
};
