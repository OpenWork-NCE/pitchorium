import { z } from 'zod';

/** ISO 4217 alphabetic code. The list of accepted currencies is a business decision, not a contract. */
export const currencyCodeSchema = z.string().regex(/^[A-Z]{3}$/);

/** Integer amount in minor units, as a string so that no client parses it as a float. */
export const minorUnitsSchema = z.string().regex(/^-?(0|[1-9]\d*)$/);

export const moneySchema = z.object({
  amountMinor: minorUnitsSchema,
  currency: currencyCodeSchema,
});

export type CurrencyCode = z.infer<typeof currencyCodeSchema>;
export type MoneyDto = z.infer<typeof moneySchema>;
