// Flattens a values object (as produced by a react-hook-form + zod form) into
// FormData for a multipart submission -- used wherever a form has an
// optional File field alongside its regular text fields.
export function toFormData(values: Record<string, unknown>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;
    formData.append(key, value instanceof File ? value : String(value));
  }
  return formData;
}
