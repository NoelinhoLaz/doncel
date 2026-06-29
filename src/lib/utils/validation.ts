export interface NifDetailResult {
  valid: boolean;
  type: string;
  reason?: string;
}

export function validateSpanishNifDetailed(nif: string): NifDetailResult {
  if (!nif || nif.trim().length === 0) return { valid: false, type: "Vacío", reason: "NIF no informado" };
  const raw = nif.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

  const dniMatch = raw.match(/^(\d{8})([A-Z])$/);
  if (dniMatch) {
    const letters = "TRWAGMYFPDXBNJZSQVHLCKE";
    const expected = letters[parseInt(dniMatch[1], 10) % 23];
    return dniMatch[2] === expected
      ? { valid: true, type: "DNI" }
      : { valid: false, type: "DNI", reason: `Dígito de control incorrecto (esperado: ${expected})` };
  }

  const nieMatch = raw.match(/^([XYZ])(\d{7})([A-Z])$/);
  if (nieMatch) {
    const letters = "TRWAGMYFPDXBNJZSQVHLCKE";
    const prefix: Record<string, string> = { X: "0", Y: "1", Z: "2" };
    const num = prefix[nieMatch[1]] + nieMatch[2];
    const expected = letters[parseInt(num, 10) % 23];
    return nieMatch[3] === expected
      ? { valid: true, type: "NIE" }
      : { valid: false, type: "NIE", reason: `Dígito de control incorrecto (esperado: ${expected})` };
  }

  const cifMatch = raw.match(/^([ABCDEFGHJKLMNPQRSUVW])(\d{7})([A-Z0-9])$/);
  if (cifMatch) {
    const [, type2, digits, control] = cifMatch;
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const d = parseInt(digits[i], 10);
      if ((i + 1) % 2 === 0) { sum += d; }
      else { const v = d * 2; sum += v > 9 ? v - 9 : v; }
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    const checkLetter = "JABCDEFGHI"[checkDigit];
    const isValid = "KPQS".includes(type2)
      ? control === checkLetter
      : "ABEH".includes(type2)
        ? control === String(checkDigit)
        : control === checkLetter || control === String(checkDigit);
    return isValid
      ? { valid: true, type: "CIF" }
      : { valid: false, type: "CIF", reason: "Dígito de control incorrecto" };
  }

  return { valid: false, type: "Desconocido", reason: "Formato no reconocido como DNI/NIE/CIF" };
}

export function isValidSpanishNifCif(doc: string): boolean {
  if (!doc) return false;
  const clean = doc.trim().replace(/[\s.\-]/g, "").toUpperCase();
  if (clean.length !== 9) return false;

  const dniReg = /^[0-9]{8}[A-Z]$/;
  const nieReg = /^[XYZ][0-9]{7}[A-Z]$/;

  if (dniReg.test(clean) || nieReg.test(clean)) {
    let dniStr = clean;
    if (nieReg.test(clean)) {
      const niePrefix: Record<string, string> = { X: "0", Y: "1", Z: "2" };
      dniStr = niePrefix[clean[0]] + clean.slice(1);
    }
    const num = parseInt(dniStr.slice(0, 8), 10);
    const letters = "TRWAGMYFPDXBNJZSQVHLCKE";
    return letters[num % 23] === clean[8];
  }

  const cifReg = /^[ABCDEFGHJNPQRSTUVW][0-9]{7}[0-9A-J]$/;
  if (cifReg.test(clean)) {
    const digits = clean.slice(1, 8);
    const control = clean[8];
    let sumEven = 0;
    let sumOdd = 0;
    for (let i = 0; i < 7; i++) {
      const val = parseInt(digits[i], 10);
      if (i % 2 === 0) {
        const double = val * 2;
        sumOdd += double > 9 ? double - 9 : double;
      } else {
        sumEven += val;
      }
    }
    const total = sumEven + sumOdd;
    const digit = total % 10 === 0 ? 0 : 10 - (total % 10);
    return control === String(digit) || control === "JABCDEFGHI"[digit];
  }

  return false;
}
