'use client'

import React from 'react'
import {
  Select as AriaSelect,
  Label,
  Button,
  SelectValue,
  Popover,
  ListBox,
  ListBoxItem,
  type SelectProps as AriaSelectProps,
} from 'react-aria-components'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  id: string | number
  label: string
  description?: string
}

interface SelectProps<T extends SelectOption> extends Omit<AriaSelectProps<T>, 'children'> {
  label?: string
  description?: string
  items: T[]
  placeholder?: string
  className?: string
}

export function Select<T extends SelectOption>({
  label,
  description,
  items,
  placeholder = 'Seleccionar...',
  className,
  ...props
}: SelectProps<T>) {
  return (
    <AriaSelect
      {...props}
      className={cn('flex flex-col gap-1 w-full', className)}
    >
      {label && (
        <Label className="text-sm font-medium text-gray-700">
          {label}
        </Label>
      )}
      <Button className="flex items-center justify-between w-full px-3 py-2 text-sm text-left bg-white border border-gray-300 rounded-lg shadow-sm outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] transition-all disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed group">
        <SelectValue className="truncate group-data-[placeholder]:text-gray-400">
          {({ selectedItem }) => (
            (selectedItem as T | null)?.label ?? placeholder
          )}
        </SelectValue>
        <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" aria-hidden="true" />
      </Button>
      {description && (
        <p className="text-xs text-gray-500">{description}</p>
      )}
      <Popover className="w-[--trigger-width] overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg z-50">
        <ListBox
          items={items}
          className="p-1 outline-none text-sm text-gray-700 max-h-60"
        >
          {(item) => (
            <ListBoxItem
              id={item.id}
              textValue={item.label}
              className="flex items-center justify-between px-3 py-2 rounded-md cursor-pointer outline-none hover:bg-gray-50 data-[focused]:bg-gray-100 data-[selected]:bg-blue-50 data-[selected]:text-[#003087] transition-colors"
            >
              {({ isSelected }) => (
                <>
                  <div className="flex flex-col">
                    <span className={cn('block truncate', isSelected ? 'font-medium' : 'font-normal')}>
                      {item.label}
                    </span>
                    {item.description && (
                      <span className="text-xs text-gray-500 truncate">{item.description}</span>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-[#003087]" aria-hidden="true" />
                  )}
                </>
              )}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </AriaSelect>
  )
}
