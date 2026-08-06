'use client'

import { useState, useRef, useEffect } from 'react'
import { Check, ChevronsUpDown, Loader2, Plus } from 'lucide-react'

export interface CreatableOption {
  value: string | number
  label: string
}

interface CreatableSelectProps {
  options: CreatableOption[]
  value?: string | number | null
  onChange: (value: string | number) => void
  onCreate?: (inputValue: string) => Promise<string | number>
  placeholder?: string
  disabled?: boolean
  className?: string
  required?: boolean
}

export function CreatableSelect({
  options,
  value,
  onChange,
  onCreate,
  placeholder = 'Seleccionar...',
  disabled = false,
  className = '',
  required = false
}: CreatableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((opt) => String(opt.value) === String(value))

  useEffect(() => {
    if (!isOpen) {
      setInputValue(selectedOption ? selectedOption.label : '')
    }
  }, [isOpen, selectedOption])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(inputValue.toLowerCase())
  )

  const exactMatch = options.find(
    (opt) => opt.label.toLowerCase() === inputValue.trim().toLowerCase()
  )

  const handleSelect = (val: string | number) => {
    onChange(val)
    setIsOpen(false)
  }

  const handleCreate = async () => {
    if (!onCreate || !inputValue.trim() || isCreating) return
    setIsCreating(true)
    try {
      const newVal = await onCreate(inputValue.trim())
      onChange(newVal)
      setIsOpen(false)
    } catch (error) {
      console.error('Error creating option', error)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <div className="relative">
        <input
          type="text"
          value={isOpen ? inputValue : selectedOption ? selectedOption.label : ''}
          onChange={(e) => {
            setInputValue(e.target.value)
            setIsOpen(true)
            if (e.target.value === '') onChange('') // allowing clear
          }}
          onFocus={() => setIsOpen(true)}
          disabled={disabled || isCreating}
          placeholder={placeholder}
          required={required && !value}
          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] bg-white disabled:bg-gray-50 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          disabled={disabled || isCreating}
          onClick={() => setIsOpen(!isOpen)}
          className="absolute inset-y-0 right-0 flex items-center px-2 text-gray-400 hover:text-gray-600 focus:outline-none disabled:opacity-50"
        >
          {isCreating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ChevronsUpDown className="w-4 h-4" />
          )}
        </button>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 flex flex-col overflow-hidden py-1 text-sm">
          <div className="overflow-y-auto max-h-48">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  className={`px-3 py-2 cursor-pointer hover:bg-gray-100 flex items-center justify-between transition-colors ${String(opt.value) === String(value) ? 'bg-[#003087]/5 text-[#003087] font-medium' : 'text-gray-700'
                    }`}
                >
                  <span>{opt.label}</span>
                  {String(opt.value) === String(value) && <Check className="w-4 h-4 text-[#003087]" />}
                </div>
              ))
            ) : (
              !inputValue.trim() && (
                <div className="px-3 py-3 text-center text-gray-400 text-xs italic">
                  Escriba o seleccione de la lista...
                </div>
              )
            )}
          </div>

          {inputValue.trim() && !exactMatch && onCreate && (
            <div
              onClick={handleCreate}
              className="px-3 py-2.5 mt-1 cursor-pointer text-[#003087] bg-blue-50/50 hover:bg-blue-50 border-t border-gray-100 flex items-center font-medium transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear "{inputValue.trim()}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}
