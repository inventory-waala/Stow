export function trialCta(signedIn: boolean): { label: string; href: string } {
  return signedIn
    ? { label: "Open dashboard", href: "/dashboard" }
    : { label: "Start free trial", href: "/signup" }
}
