export default function PurchasesLayout({ children }: LayoutProps<"/purchases">) {
  return (
    // The (app) layout adds no vertical rhythm, so each section supplies its
    // own. `*:min-w-0` stops a wide table stretching the grid instead of
    // scrolling inside its panel.
    <div className="grid gap-6 *:min-w-0">{children}</div>
  )
}
