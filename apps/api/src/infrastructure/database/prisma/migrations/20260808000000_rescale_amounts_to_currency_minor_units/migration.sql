-- Rescale stored amounts to each currency's real minor unit.
--
-- WHY
--
-- ADR 0004 requires "a configuration/reference table (minor units per
-- currency)". Nothing implemented it: every amount was written by the web layer
-- at a flat ×100, for every currency. The table now exists in
-- `@plinto/shared` (packages/shared/money/currency.ts) and follows CLDR, so
-- amounts already in this database are at the wrong scale for any currency
-- whose minor unit is not 1/100.
--
-- For COP — the default currency of a household — the old scale meant a stored
-- 230000000 was rendered as `$ 2.300.000,00`, inventing a centavo that has not
-- circulated in decades, and burned two digits of a 32-bit column on digits
-- that are structurally always zero.
--
-- WHAT THIS DOES
--
--   * currencies now at 0 decimals: value / 100   (2 300 000,00 -> 2 300 000)
--   * currencies now at 3 decimals: value * 10    (1,23 -> 1,230)
--   * currencies still at 2 decimals: untouched
--
-- The two currency lists are generated from `CURRENCIES_WITH_NON_DEFAULT_MINOR_UNITS`
-- in packages/shared/money/currency.ts. They are not maintained by hand here;
-- if that table changes, this migration stays as the historical record of the
-- scale at the time it ran and a NEW migration handles the newer change.
--
-- THIS IS NOT REVERSIBLE. Dividing by 100 discards any sub-unit that was stored
-- for a zero-decimal currency. Such a value could only have come from the
-- transfer form's old "Fee, in minor units" field, where a person could type 5
-- and mean 0,05 COP — an amount that does not exist. Rounding it to 0 is the
-- correct reading of nonsense input, but it cannot be undone.
--
-- To see what this will change before applying it, run:
--
--   SELECT currency, count(*), min(amount_minor), max(amount_minor)
--   FROM transactions
--   WHERE currency IN ('AFN','ALL','BIF','CLP','COP','DJF','GNF','HUF','IDR',
--     'IQD','IRR','ISK','JPY','KMF','KPW','KRW','LAK','LBP','MGA','MMK','PKR',
--     'PYG','RWF','SLL','SOS','SYP','UGX','VND','VUV','XAF','XOF','XPF','YER')
--     AND amount_minor % 100 <> 0
--   GROUP BY currency;
--
-- Any row it returns is one whose sub-unit will be rounded away.

-- ---------------------------------------------------------------------------
-- Zero-decimal currencies: divide by 100
-- ---------------------------------------------------------------------------

UPDATE "transactions"
SET "amount_minor" = ROUND("amount_minor" / 100.0)::int
WHERE "currency" IN ('AFN','ALL','BIF','CLP','COP','DJF','GNF','HUF','IDR','IQD','IRR','ISK','JPY','KMF','KPW','KRW','LAK','LBP','MGA','MMK','PKR','PYG','RWF','SLL','SOS','SYP','UGX','VND','VUV','XAF','XOF','XPF','YER');

UPDATE "recurring_transaction_rules"
SET "amount_minor" = ROUND("amount_minor" / 100.0)::int
WHERE "currency" IN ('AFN','ALL','BIF','CLP','COP','DJF','GNF','HUF','IDR','IQD','IRR','ISK','JPY','KMF','KPW','KRW','LAK','LBP','MGA','MMK','PKR','PYG','RWF','SLL','SOS','SYP','UGX','VND','VUV','XAF','XOF','XPF','YER');

UPDATE "obligation_instances"
SET "expected_amount_minor" = ROUND("expected_amount_minor" / 100.0)::int
WHERE "currency" IN ('AFN','ALL','BIF','CLP','COP','DJF','GNF','HUF','IDR','IQD','IRR','ISK','JPY','KMF','KPW','KRW','LAK','LBP','MGA','MMK','PKR','PYG','RWF','SLL','SOS','SYP','UGX','VND','VUV','XAF','XOF','XPF','YER');

-- A transfer stores each leg in its own currency, so the two sides rescale
-- independently — a COP -> USD transfer moves one column and not the other.
UPDATE "transfers"
SET "source_amount_minor" = ROUND("source_amount_minor" / 100.0)::int
WHERE "source_currency" IN ('AFN','ALL','BIF','CLP','COP','DJF','GNF','HUF','IDR','IQD','IRR','ISK','JPY','KMF','KPW','KRW','LAK','LBP','MGA','MMK','PKR','PYG','RWF','SLL','SOS','SYP','UGX','VND','VUV','XAF','XOF','XPF','YER');

UPDATE "transfers"
SET "destination_amount_minor" = ROUND("destination_amount_minor" / 100.0)::int
WHERE "destination_currency" IN ('AFN','ALL','BIF','CLP','COP','DJF','GNF','HUF','IDR','IQD','IRR','ISK','JPY','KMF','KPW','KRW','LAK','LBP','MGA','MMK','PKR','PYG','RWF','SLL','SOS','SYP','UGX','VND','VUV','XAF','XOF','XPF','YER');

-- The fee is charged on the source side and therefore carries the source
-- currency. `transfers` has no fee currency column; this is the assumption the
-- transfer form has always made and now states out loud.
UPDATE "transfers"
SET "fee_minor" = ROUND("fee_minor" / 100.0)::int
WHERE "fee_minor" IS NOT NULL
  AND "source_currency" IN ('AFN','ALL','BIF','CLP','COP','DJF','GNF','HUF','IDR','IQD','IRR','ISK','JPY','KMF','KPW','KRW','LAK','LBP','MGA','MMK','PKR','PYG','RWF','SLL','SOS','SYP','UGX','VND','VUV','XAF','XOF','XPF','YER');

-- ---------------------------------------------------------------------------
-- Three-decimal currencies: multiply by 10
-- ---------------------------------------------------------------------------

UPDATE "transactions"
SET "amount_minor" = "amount_minor" * 10
WHERE "currency" IN ('BHD','JOD','KWD','LYD','OMR','TND');

UPDATE "recurring_transaction_rules"
SET "amount_minor" = "amount_minor" * 10
WHERE "currency" IN ('BHD','JOD','KWD','LYD','OMR','TND');

UPDATE "obligation_instances"
SET "expected_amount_minor" = "expected_amount_minor" * 10
WHERE "currency" IN ('BHD','JOD','KWD','LYD','OMR','TND');

UPDATE "transfers"
SET "source_amount_minor" = "source_amount_minor" * 10
WHERE "source_currency" IN ('BHD','JOD','KWD','LYD','OMR','TND');

UPDATE "transfers"
SET "destination_amount_minor" = "destination_amount_minor" * 10
WHERE "destination_currency" IN ('BHD','JOD','KWD','LYD','OMR','TND');

UPDATE "transfers"
SET "fee_minor" = "fee_minor" * 10
WHERE "fee_minor" IS NOT NULL
  AND "source_currency" IN ('BHD','JOD','KWD','LYD','OMR','TND');
