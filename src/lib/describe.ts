/**
 * Turn a raw bank description into something a person can read.
 *
 *   "ATTA FILLING STATION LAHORE PK POS Transaction"      -> "Atta Filling Station"
 *   "Raast P2P Fund transfer to MUHAMMAD SHAHID IQBAL PK35TMFBxxxx8501"
 *                                                          -> "To Muhammad Shahid Iqbal"
 *   "Money Transferred to AHMAD 0030-****993694"           -> "To Ahmad"
 *
 * Display only. The stored description is never changed: import dedupe and
 * rules match on the raw text, and the entry page still shows it in full.
 * Anything typed by hand (mixed case) is returned untouched.
 */
export function prettyDescription(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return s;
  // Hand-written entries already read well; leave them alone.
  const letters = s.replace(/[^A-Za-z]/g, "");
  const upper = letters.replace(/[^A-Z]/g, "").length;
  const bankish = /POS Transaction|Raast|Money Transferred|Fund transfer|Remittance|Batch Transfer|ADJUSTMENT|Online Purchase/i.test(s);
  if (!bankish && upper / Math.max(1, letters.length) < 0.6) return s;

  // A Raast P2M to a merchant ID carries no name at all — say what it was.
  if (/^Raast P2M to MID\b/i.test(s)) return "QR payment";

  let t = s
    .replace(/\bPOS Transaction\b/i, "")
    .replace(/\bX{3,}\d+\b/gi, "")                     // masked account, "XXXX0005…"
    .replace(/\b(LAHORE|KARACHI|ISLAMABAD|RAWALPINDI)\s+PK\b/gi, "")
    .replace(/\bPK\d{2}[A-Z]{4}x+\d+\b/gi, "")          // masked IBAN
    .replace(/\b\d{3,4}-\*+\d+\b/g, "")                 // masked account no.
    .replace(/\+\d{8,}\s*[A-Z]{2}\b/g, "")              // card merchant phone + country
    .replace(/^Raast P2[PM] (Fund transfer )?to\s+/i, "To ")
    .replace(/^Money Transferred to\s+/i, "To ")
    .replace(/^Online Purchase\s+/i, "")
    .replace(/^Remittance From\s+/i, "From ")
    .replace(/\s+(Bank Al-Habib|Bank of|Jazz Cash|EasyPaisa-Telenor Bank|Dubai Islamic|Bank)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s-]+$/, "")
    .trim();

  // Title-case the shouting, but keep short all-caps tokens (LESCO, PTCL, FED).
  t = t.replace(/[A-Za-z][A-Za-z'.-]*/g, (w) =>
    w.length <= 5 && w === w.toUpperCase() && /^(LESCO|PTCL|SNGPL|FED|ATM|LGS|KFC|PVT|LTD|SUB|US)$/.test(w)
      ? w
      : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  );
  return t || s;
}
