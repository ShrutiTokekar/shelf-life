# Labeled receipt set (SRS 13)

The OCR accuracy score comes from real grocery receipts: at least 50, from at least five stores
(Patel Brothers, Costco, Trader Joe's, Target, H Mart). The target is **85% of grocery lines
matched to the right food**.

## Privacy: what gets committed

The repo is public, so **photos are never committed**. They stay on your machine in
`tests/receipts/photos/`, which git ignores. Only text is committed: one JSON file per receipt
in `labels/`, holding the lines the app read and the right answer for each line.

Before a label is written, `lib/redact.ts` removes:

- card and account numbers, approval, register and transaction numbers;
- loyalty and member IDs, and any long number;
- cashier, member or customer names;
- phone numbers, street numbers and zip codes;
- email addresses;
- the time of purchase (the date stays).

Grocery lines, prices, tax and the total stay, because they're what gets scored. **Read each JSON
file before you commit it**, and delete anything that still looks personal.

## Adding receipts

1. Put photos in `tests/receipts/photos/`, named by store, e.g. `patel-brothers-01.jpg`,
   `costco-03.heic`, `trader-joes-02.png`, `target-01.jpg`, `h-mart-04.jpg`.
2. Run the labeler. It reads each new photo with the app's own OCR in a local browser (no API,
   and it fails if any request leaves `localhost`), then writes `labels/<name>.json`:

   ```bash
   pnpm receipts:label
   ```

3. Open each new JSON file. Every line has an `expect`, pre-filled with what the parser guessed:
   - a food id from `packages/shared/src/food/data/` for a grocery line;
   - `"skip"` for totals, tax, store info, weights and non-food items;
   - `"missing:<name>"` for a grocery the dictionary doesn't know yet.

   Fix the wrong ones, then set `"checked": true`. Unchecked labels are not scored.

4. Score:

   ```bash
   pnpm receipts:score
   ```

CI runs the score on every PR and posts it in the job summary. Until there are 50 checked
receipts it's a baseline; after that, a score under 85% fails the build.

## Tune and holdout

Every fifth receipt (chosen by a hash of its name) is marked `"split": "holdout"`. Only `tune`
receipts' misses are used to add names to the dictionary. The holdout score shows how the parser
does on receipts it wasn't adjusted for, so the headline number can't be inflated by tuning.

Re-run a photo with `RELABEL=1 pnpm receipts:label` (this overwrites your corrections for it).
