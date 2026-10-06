"use client"

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion"

export const EASE = [0.32, 0.72, 0, 1] as const

/**
 * Fade-up on viewport entry. Animates transform + opacity only, once, and
 * degrades to a static render when the user prefers reduced motion.
 */
export function Reveal({
  delay = 0,
  y = 20,
  children,
  ...props
}: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, delay, ease: EASE }}
      {...props}
    >
      {children}
    </motion.div>
  )
}
