const sanitizePhone = (phone = "") => {
  if (typeof phone !== "string") throw new Error("Invalid phone number");
  const cleaned = phone.trim();
  if (cleaned && !/^\+?[0-9\s()-]{7,20}$/.test(cleaned)) {
    throw new Error("Enter a valid phone number");
  }
  return cleaned;
};
module.exports = { sanitizePhone };
