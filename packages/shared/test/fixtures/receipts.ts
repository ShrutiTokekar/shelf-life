/**
 * Typed receipt text in five store formats (SRS 13: Patel Brothers, Costco, Trader Joe's, Target,
 * H Mart). Written from the formats these stores print; not real customer receipts. The labeled
 * set of real receipt photos is Milestone 4 (tests/receipts/).
 */
export const PATEL_BROTHERS = `PATEL BROTHERS
1234 DEVON AVE
CHICAGO IL 60659
09/27/26 14:32
TOOR DAL 4LB      8.99
GV WHL MLK        4.29
PANEER 400G       5.49
CILANTRO          0.99
SPINACH BAG       2.99
GRK YOGURT        4.79
ATTA 20LB        16.99
TOMATO ON VINE    3.12
SUBTOTAL         47.65
TAX               1.23
TOTAL            48.88
VISA ****1234    48.88
THANK YOU FOR SHOPPING`;

export const COSTCO = `COSTCO WHOLESALE
SAN JOSE #423
E 1234567 KS ORG EGGS 24CT      9.99 E
  512345 KS WHL MILK 2PK        6.49
E 98765 BANANAS                 1.99 E
  334455 KS TP 30RL            22.99 A
  778899 ROTISSERIE CHKN        4.99
  223344 AVOCADOS 6CT           6.99
  1234 /334455                  3.00-
SUBTOTAL                       50.44
TAX                             1.95
**** TOTAL                     52.39
XXXXXXXXXXXX1234 CHIP READ
APPROVED # 123456
09/26/2026 18:04`;

export const TRADER_JOES = `TRADER JOE'S
2001 Market St
San Francisco CA 94114
ORGANIC BANANAS            0.87
  3 @ 0.29
BABY SPINACH               2.49
GREEK NONFAT YOGURT PLAIN  4.49
TORTILLAS FLOUR            2.99
MANDARIN ORANGE CHICKEN    4.99
CARROTS WHOLE ORGANIC 2LB  1.99
SUBTOTAL                  17.82
TOTAL                     17.82
VISA                      17.82
09-25-2026 12:44PM`;

export const TARGET = `TARGET
Store T-1234
   GROCERY
212040123 GG ORGANIC WHOLE MILK  NF   4.29
071010789 GG LARGE EGGS 12CT     NF   2.99
288090222 AVOCADO HASS           NF   1.39
211130456 GG SHREDDED CHEDDAR    NF   2.79
   HOME
246010111 UP&UP PAPER TOWEL 6PK  T    9.99
SUBTOTAL                        21.45
T = CA TAX 9.25000 on 9.99      0.92
TOTAL                           22.37
*1234 VISA CHARGE               22.37
09/24/2026 07:15 PM`;

export const H_MART = `H MART
123 MAIN ST
FORT LEE NJ 07024
NAPA CABBAGE                 3.53
  2.37 lb @ 1.49 /lb
GREEN ONION                  0.99
TOFU FIRM 14OZ               1.99
BIBIGO MANDU                 6.99
KIMCHI 1.5LB                 8.99
ENOKI MUSHROOM               1.49
SHIN RAMYUN 4PK              4.99
TOTAL                       28.97
MASTERCARD                  28.97
09/23/26 11:02`;

/** OCR lines as the parser receives them: every line at a given OCR confidence. */
export const asOcr = (text: string, confidence = 0.95) =>
  text.split('\n').map((line) => ({ text: line, confidence }));
