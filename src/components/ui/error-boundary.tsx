'use client'

import React from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(JSON.stringify({ event: 'react_error', error: error.message, component: info.componentStack?.split('\n')[1]?.trim() }))
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50">
            <span className="text-xl">⚠</span>
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-700">Something went wrong</p>
            <p className="mt-1 text-xs text-neutral-400">{this.state.message || 'An unexpected error occurred'}</p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="text-xs text-violet-600 hover:underline"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
