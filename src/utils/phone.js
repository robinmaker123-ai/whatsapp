const normalizePhone = (phone = "") => {
  const rawPhone = String(phone).trim();

  if (!rawPhone) {
    return "";
  }

  if (rawPhone.startsWith("+")) {
    return `+${rawPhone.slice(1).replace(/\D/g, "")}`;
  }

  return rawPhone.replace(/\D/g, "");
};

const isValidPhone = (phone) => /^\+?[1-9]\d{9,14}$/.test(phone);

module.exports = {
  normalizePhone,
  isValidPhone,
};
