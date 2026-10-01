import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? Number(value) : value ?? 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(num) ? num : 0);
}

export function formatCurrencyPrecise(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? Number(value) : value ?? 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(num) ? num : 0);
}

export function formatWeight(lbs: number | string | null | undefined): string {
  const num = typeof lbs === "string" ? Number(lbs) : lbs ?? 0;
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(num)} lb`;
}

export function formatFootage(ft: number | string | null | undefined): string {
  const num = typeof ft === "string" ? Number(ft) : ft ?? 0;
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(num)} ft`;
}

export function formatPercent(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? Number(value) : value ?? 0;
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(num)}%`;
}
