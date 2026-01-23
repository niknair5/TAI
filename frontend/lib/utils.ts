import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateDeviceId(): string {
  return `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function getStoredDeviceId(): string {
  if (typeof window === "undefined") return "";
  
  let deviceId = localStorage.getItem("tai_device_id");
  if (!deviceId) {
    deviceId = generateDeviceId();
    localStorage.setItem("tai_device_id", deviceId);
  }
  return deviceId;
}

export function getStoredUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("tai_user_id");
}

export function setStoredUserId(userId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("tai_user_id", userId);
}

export function getStoredRole(): "student" | "teacher" | null {
  if (typeof window === "undefined") return null;
  const role = localStorage.getItem("tai_role");
  if (role === "student" || role === "teacher") return role;
  return null;
}

export function setStoredRole(role: "student" | "teacher"): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("tai_role", role);
}

export function clearStoredUser(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("tai_user_id");
  localStorage.removeItem("tai_role");
}

// Legacy support
export function generateStudentId(): string {
  return generateDeviceId();
}

export function getStoredStudentId(): string {
  return getStoredDeviceId();
}
