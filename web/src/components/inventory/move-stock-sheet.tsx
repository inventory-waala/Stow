"use client"

import { ArrowLeftRightIcon } from "lucide-react"

import type { Location, Size } from "@/lib/inventory/types"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { MovementForm } from "./movement-form"

/** Records a movement for one stock line of a variant, from the product page. */
export function MoveStockSheet({
  productId,
  variantName,
  size,
  locations,
}: {
  productId: string
  variantName: string
  size: Size
  locations: Location[]
}) {
  const label = size.label === "Default" ? variantName : `${variantName} · ${size.label}`

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" className="rounded-full">
            <ArrowLeftRightIcon className="size-3.5" />
            Move
          </Button>
        }
      />
      <SheetContent className="w-full overflow-y-auto sm:max-w-md!">
        <SheetHeader>
          <SheetTitle>Move stock — {label}</SheetTitle>
          <SheetDescription>{size.sku ? <span className="font-mono">{size.sku}</span> : "Receive, issue, transfer or count this line."}</SheetDescription>
        </SheetHeader>
        <MovementForm
          target={{ sizeId: size.id, productId, unit: size.unit, totals: size.stock_totals }}
          locations={locations}
        />
      </SheetContent>
    </Sheet>
  )
}
