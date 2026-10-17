export interface RamMilestone {
  value: number
  label: string
}

export function getRamMilestones(totalGb: number): RamMilestone[] {
  if (totalGb >= 64) {
    return [
      { value: 4096, label: '4 GB' },
      { value: 16384, label: '16 GB' },
      { value: 32768, label: '32 GB' },
      { value: 49152, label: '48 GB' },
      { value: 65536, label: '64 GB' }
    ]
  }
  if (totalGb >= 32) {
    return [
      { value: 2048, label: '2 GB' },
      { value: 8192, label: '8 GB' },
      { value: 16384, label: '16 GB' },
      { value: 24576, label: '24 GB' },
      { value: 32768, label: '32 GB' }
    ]
  }
  if (totalGb >= 16) {
    return [
      { value: 1024, label: '1 GB' },
      { value: 4096, label: '4 GB (Recommended)' },
      { value: 8192, label: '8 GB' },
      { value: 12288, label: '12 GB' },
      { value: totalGb * 1024, label: `${totalGb} GB` }
    ]
  }
  return [
    { value: 1024, label: '1 GB' },
    { value: 2048, label: '2 GB' },
    { value: 4096, label: '4 GB (Recommended)' },
    { value: 6144, label: '6 GB' },
    { value: Math.max(4096, totalGb * 1024), label: `${Math.max(4, totalGb)} GB` }
  ]
}
