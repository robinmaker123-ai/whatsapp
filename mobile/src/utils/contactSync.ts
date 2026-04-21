import * as Contacts from "expo-contacts";
import * as Crypto from "expo-crypto";

import type { ContactHashInput } from "../types/models";

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

const getDisplayName = (contact: Contacts.Contact, fallbackPhone: string) => {
  const fallbackName = [contact.firstName, contact.middleName, contact.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return contact.name || fallbackName || fallbackPhone;
};

export const requestContactsPermissionAsync = () => Contacts.requestPermissionsAsync();

export const getContactsPermissionAsync = () => Contacts.getPermissionsAsync();

export const loadHashedDeviceContacts = async (): Promise<ContactHashInput[]> => {
  const response = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers],
  });
  const uniqueContacts = new Map<string, ContactHashInput>();

  for (const contact of response.data) {
    for (const phoneEntry of contact.phoneNumbers || []) {
      const normalizedPhone = normalizePhone(phoneEntry.number || "");

      if (!normalizedPhone) {
        continue;
      }

      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        normalizedPhone
      );

      if (uniqueContacts.has(hash)) {
        continue;
      }

      uniqueContacts.set(hash, {
        hash,
        displayName: getDisplayName(contact, normalizedPhone),
        phone: normalizedPhone,
      });
    }
  }

  return Array.from(uniqueContacts.values()).sort((firstContact, secondContact) =>
    firstContact.displayName.localeCompare(secondContact.displayName)
  );
};
