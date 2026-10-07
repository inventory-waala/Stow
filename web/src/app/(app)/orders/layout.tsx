export default function OrdersLayout({ children }: LayoutProps<"/orders">) {
  return <div className="grid gap-6 *:min-w-0">{children}</div>
}
