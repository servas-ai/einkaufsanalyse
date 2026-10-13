import { createContext, useContext } from 'react'
import type { FG, Receipt } from './lib/data'
export type Ctx = { receipts: Receipt[]; isDemo: boolean; fg: Map<number, FG>; setReal: (r: Receipt[] | null) => void; addReceipts: (r: Receipt[]) => void; base: string }
export const AppCtx = createContext<Ctx>(null as any)
export const useApp = () => useContext(AppCtx)
