import { currencyExponent, isActiveCurrency, minorUnitsPerMajor } from './currency';
import { DomainError } from './domain-error';

const MINOR_UNITS_PATTERN = /^-?(0|[1-9]\d*)$/;
const DECIMAL_PATTERN = /^(-?)(0|[1-9]\d*)(?:\.(\d+))?$/;

export interface MoneyJson {
  amountMinor: string;
  currency: string;
}

/**
 * Amount in minor units of an active ISO 4217 currency, whose exponent gives the decimals
 * (EUR 2, XOF 0). Never a float: arithmetic and conversions stay on bigint and strings.
 */
export class Money {
  private constructor(
    readonly amountMinor: bigint,
    readonly currency: string,
  ) {}

  static of(amountMinor: bigint | string, currency: string): Money {
    if (!isActiveCurrency(currency)) {
      throw new DomainError('VALIDATION_FAILED', `Invalid ISO 4217 currency code: ${currency}`);
    }
    if (typeof amountMinor === 'string' && !MINOR_UNITS_PATTERN.test(amountMinor)) {
      throw new DomainError('VALIDATION_FAILED', `Invalid minor units amount: ${amountMinor}`);
    }
    return new Money(BigInt(amountMinor), currency);
  }

  static zero(currency: string): Money {
    return Money.of(0n, currency);
  }

  static fromJSON(json: MoneyJson): Money {
    return Money.of(json.amountMinor, json.currency);
  }

  /**
   * Parses a decimal amount in major units (`12.50` EUR, `5000` XOF). More decimals than the
   * exponent of the currency are refused rather than rounded.
   */
  static fromDecimal(decimal: string, currency: string): Money {
    const exponent = currencyExponent(currency);
    const match = DECIMAL_PATTERN.exec(decimal);
    const fraction = match?.[3] ?? '';
    if (!match || fraction.length > exponent) {
      throw new DomainError('VALIDATION_FAILED', `Invalid ${currency} amount: ${decimal}`);
    }
    const minor = BigInt(`${match[2]}${fraction.padEnd(exponent, '0')}`);
    return new Money(match[1] === '-' ? -minor : minor, currency);
  }

  /** Decimals of the minor unit of the currency. */
  get exponent(): number {
    return currencyExponent(this.currency);
  }

  /** Decimal amount in major units, with exactly `exponent` decimals: `12.50`, `5000`. */
  toDecimal(): string {
    const exponent = this.exponent;
    const sign = this.amountMinor < 0n ? '-' : '';
    const absolute = this.amountMinor < 0n ? -this.amountMinor : this.amountMinor;
    const major = absolute / minorUnitsPerMajor(this.currency);
    if (exponent === 0) return `${sign}${major}`;
    const fraction = (absolute % minorUnitsPerMajor(this.currency))
      .toString()
      .padStart(exponent, '0');
    return `${sign}${major}.${fraction}`;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor + other.amountMinor, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor - other.amountMinor, this.currency);
  }

  multiply(factor: bigint): Money {
    return new Money(this.amountMinor * factor, this.currency);
  }

  negate(): Money {
    return new Money(-this.amountMinor, this.currency);
  }

  /**
   * Splits the amount according to integer ratios without losing a minor unit: the remainder
   * goes, one unit at a time, to the first shares.
   */
  allocate(ratios: readonly bigint[]): Money[] {
    if (ratios.length === 0 || ratios.some((ratio) => ratio < 0n)) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Ratios must be a non-empty list of non-negative integers',
      );
    }
    const total = ratios.reduce((sum, ratio) => sum + ratio, 0n);
    if (total === 0n) {
      throw new DomainError('VALIDATION_FAILED', 'Ratios must not all be zero');
    }
    const sign = this.amountMinor < 0n ? -1n : 1n;
    const absolute = this.amountMinor * sign;
    const shares = ratios.map((ratio) => (absolute * ratio) / total);
    // Each floor loses less than one unit, so the remainder is below the number of non-zero ratios.
    let remainder = absolute - shares.reduce((sum, share) => sum + share, 0n);
    return shares.map((share, index) => {
      if (remainder > 0n && ratios[index] !== 0n) {
        remainder -= 1n;
        return new Money((share + 1n) * sign, this.currency);
      }
      return new Money(share * sign, this.currency);
    });
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    if (this.amountMinor === other.amountMinor) return 0;
    return this.amountMinor < other.amountMinor ? -1 : 1;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amountMinor === other.amountMinor;
  }

  isZero(): boolean {
    return this.amountMinor === 0n;
  }

  isPositive(): boolean {
    return this.amountMinor > 0n;
  }

  isNegative(): boolean {
    return this.amountMinor < 0n;
  }

  toJSON(): MoneyJson {
    return { amountMinor: this.amountMinor.toString(), currency: this.currency };
  }

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) {
      throw new DomainError(
        'VALIDATION_FAILED',
        `Currency mismatch: ${this.currency} and ${other.currency}`,
      );
    }
  }
}
