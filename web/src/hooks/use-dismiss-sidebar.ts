"use client"

import { useCallback } from "react"

import { useSidebar } from "@/components/ui/sidebar"

/**
 * Dismisses the mobile sidebar after a tap that takes the user somewhere.
 *
 * On mobile the sidebar is a sheet over the page, so leaving it open after a
 * navigation hides the page the user just asked for. On desktop it is part of
 * the layout and must stay as the user left it.
 */
export function useDismissSidebar() {
  const { isMobile, setOpenMobile } = useSidebar()

  return useCallback(() => {
    if (isMobile) setOpenMobile(false)
  }, [isMobile, setOpenMobile])
}
