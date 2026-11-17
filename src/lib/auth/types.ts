export interface AccountUser { customerId: string; customerCode: string; email: string; fullName: string; phone: string }

export interface AddressDto {
  id: string; fullName: string; phone: string; line1: string; area: string; city: string;
  postalCode: string; instructions: string; isDefault: boolean;
}

/** A development-only one-time link, shown on screen because no email is sent in demo mode. */
export type DevLink = { devLink?: string };
export type Ok<T = object> = { ok: true } & T;
export type Err = { ok: false; error: string; code?: string };
