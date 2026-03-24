'use client'

import { createContext, useContext, ReactNode } from 'react'

interface AuthContextType {
  user: null
  isLoaded: true
  isSignedIn: false
  email: string | null
}

// Demo mode context — used when Clerk is not configured
const DemoAuthContext = createContext<AuthContextType>({
  user: null,
  isLoaded: true,
  isSignedIn: false,
  email: null,
})

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  return (
    <DemoAuthContext.Provider value={{ user: null, isLoaded: true, isSignedIn: false, email: null }}>
      {children}
    </DemoAuthContext.Provider>
  )
}

export function useAuthContext() {
  return useContext(DemoAuthContext)
}
