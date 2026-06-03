import type { DetailInfoField } from './types'

interface DetailInfoGridProps {
  fields: DetailInfoField[]
  className: string
}

export function DetailInfoGrid({ fields, className }: DetailInfoGridProps) {
  return (
    <div className={className}>
      {fields.map((field, index) => (
        <dl key={`${field.label}-${index}`} className="border-border/40 border-b py-2">
          <dt className="text-muted-foreground text-xs">{field.label}</dt>
          <dd className="pt-1 text-sm font-medium break-all">{field.value}</dd>
        </dl>
      ))}
    </div>
  )
}
