export async function sendOtp(phone: string): Promise<{ sent?: boolean; alreadyVerified?: boolean; demoMode?: boolean }> {
  const res = await fetch("/api/otp/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message ?? "Couldn't send the verification code.");
  return body;
}

export async function verifyOtp(phone: string, code: string): Promise<{ verified: boolean }> {
  const res = await fetch("/api/otp/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message ?? "Couldn't verify the code.");
  return body;
}
