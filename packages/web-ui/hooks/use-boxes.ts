'use client'

import { useState, useCallback } from 'react'
import { Box } from '@/types/box'
import { apiClient } from '@/lib/api'

export function useBoxes() {
  const [boxes, setBoxes] = useState<Box[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiClient.listBoxes()
      setBoxes(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch boxes')
      console.error('Failed to fetch boxes:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const createBox = useCallback(async (type: 'linux' | 'android', params?: any) => {
    setLoading(true)
    setError(null)
    try {
      const newBox = type === 'linux' 
        ? await apiClient.createLinuxBox(params)
        : await apiClient.createAndroidBox(params)
      
      setBoxes(prev => [...prev, newBox])
      return newBox
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create box')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteBox = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      await apiClient.deleteBox(id)
      setBoxes(prev => prev.filter(box => box.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete box')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const startBox = useCallback(async (id: string) => {
    try {
      await apiClient.startBox(id)
      setBoxes(prev => prev.map(box => 
        box.id === id ? { ...box, status: 'running' } : box
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start box')
      throw err
    }
  }, [])

  const stopBox = useCallback(async (id: string) => {
    try {
      await apiClient.stopBox(id)
      setBoxes(prev => prev.map(box => 
        box.id === id ? { ...box, status: 'stopped' } : box
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop box')
      throw err
    }
  }, [])

  return {
    boxes,
    loading,
    error,
    refresh,
    createBox,
    deleteBox,
    startBox,
    stopBox,
  }
}