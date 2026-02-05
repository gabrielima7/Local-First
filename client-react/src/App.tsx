import { useState } from 'react'
import { useSyncDB } from '@/hooks/useSyncDB'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Wifi, WifiOff, RefreshCw, Trash2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

function App() {
  const { items, status, isReady, addItem, deleteItem } = useSyncDB()
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKey || !newValue) return

    await addItem(newKey, {
      value: newValue,
      timestamp: Date.now(),
      created_at: new Date().toISOString()
    })

    setNewKey('')
    setNewValue('')
  }

  const handleDelete = async (key: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
        await deleteItem(key)
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'online': return <Wifi className="h-4 w-4 text-green-500" />
      case 'offline': return <WifiOff className="h-4 w-4 text-red-500" />
      case 'syncing': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
    }
  }

  const getStatusText = () => {
      switch (status) {
        case 'online': return 'Online'
        case 'offline': return 'Offline'
        case 'syncing': return 'Syncing...'
      }
  }

  if (!isReady) {
      return (
          <div className="flex h-screen w-full items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          </div>
      )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">SyncDB</h1>
            <p className="text-muted-foreground">Local-First CRDT Database</p>
          </div>
          <div className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium",
              status === 'online' ? "bg-green-500/10 text-green-700 border-green-200" :
              status === 'offline' ? "bg-red-500/10 text-red-700 border-red-200" :
              "bg-blue-500/10 text-blue-700 border-blue-200"
          )}>
            {getStatusIcon()}
            <span>{getStatusText()}</span>
          </div>
        </div>

        {/* Add Item Form */}
        <Card>
          <CardHeader>
            <CardTitle>Add New Item</CardTitle>
            <CardDescription>Create a record that syncs across devices.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="flex flex-col gap-4 sm:flex-row">
              <Input
                placeholder="Key"
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Value"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={!newKey || !newValue}>
                <Plus className="mr-2 h-4 w-4" /> Add
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Items List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Stored Items ({Object.keys(items).length})</h2>

          <div className="grid gap-4">
            {Object.entries(items).length === 0 ? (
                <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                    <p>No items found.</p>
                </div>
            ) : (
                Object.entries(items).sort((a,b) => a[0].localeCompare(b[0])).map(([key, val]) => (
                <Card key={key} className="overflow-hidden">
                    <div className="flex items-center justify-between p-4">
                        <div className="space-y-1">
                            <p className="font-medium leading-none">{key}</p>
                            <p className="text-sm text-muted-foreground">
                                {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(key)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </Card>
                ))
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

export default App
