import React from 'react'
import ReactDOM from 'react-dom/client'
import { InventoryTable, InventoryRow } from './InventoryTable'

// Datos de ejemplo tomados de la spec INV-01 §3
const rows: InventoryRow[] = [
  { id: '1', reference: '6205-2RS/C3', brand: 'SKF', quantity: 850, country: 'ES', status: 'PUBLISHED', ageDays: 2 },
  { id: '2', reference: 'NU2210-E-TVP2', brand: 'FAG', quantity: 120, country: 'ES', status: 'PUBLISHED', ageDays: 9 },
  { id: '3', reference: '7210-BECBP', brand: 'SKF', quantity: 0, country: 'ES', status: 'ARCHIVED', ageDays: 45 },
  { id: '4', reference: '6305-ZZ', brand: 'NSK', quantity: 340, country: 'ES', status: 'PUBLISHED', ageDays: 2 },
  { id: '5', reference: '22316-E', brand: 'FAG', quantity: 75, country: 'ES', status: 'DRAFT', ageDays: 1 },
]

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div style={{ background: '#F1F3F6', minHeight: '100vh', padding: 48, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 900 }}>
        <InventoryTable
          rows={rows}
          pagination={{ totalLines: 1247, currentPage: 1, totalPages: 25 }}
          onArchive={(r) => console.log('archive', r.reference)}
          onDelete={(r) => console.log('delete', r.reference)}
          onPageChange={(p) => console.log('page', p)}
        />
      </div>
    </div>
  </React.StrictMode>,
)
